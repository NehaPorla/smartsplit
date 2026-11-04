import neo4j,{Driver} from 'neo4j-driver';
import {db} from './db';
import {simplify} from './simplify';

type BalanceRow={user_id:string;user_name:string;balance:string;group_name:string};
type GraphState={driver?:Driver;schemaReady?:boolean;schemaPromise?:Promise<void>};
const globalGraph=globalThis as typeof globalThis&{smartSplitNeo4j?:GraphState};
function driver(){
  if(!process.env.NEO4J_URI||!process.env.NEO4J_USERNAME||!process.env.NEO4J_PASSWORD)return null;
  globalGraph.smartSplitNeo4j??={driver:neo4j.driver(process.env.NEO4J_URI,neo4j.auth.basic(process.env.NEO4J_USERNAME,process.env.NEO4J_PASSWORD))};
  return globalGraph.smartSplitNeo4j.driver??null;
}
async function ensureGraphSchema(neo:Driver){
  const state=globalGraph.smartSplitNeo4j??(globalGraph.smartSplitNeo4j={});
  if(state.schemaReady)return;
  if(state.schemaPromise)return state.schemaPromise;
  state.schemaPromise=(async()=>{
    const session=neo.session();
    try{
      // Collapse legacy duplicate user nodes while preserving their group memberships and debt edges.
      const users=await session.run('MATCH (n:User) WHERE n.id IS NOT NULL WITH n.id AS id,collect(n) AS nodes WHERE size(nodes)>1 RETURN id ORDER BY id');
      for(const record of users.records){
        const id=String(record.get('id'));
        const edges=await session.run('MATCH (a:User)-[r:OWES]->(b:User) WHERE a.id=$id OR b.id=$id RETURN a.id AS fromId,b.id AS toId,r.groupId AS groupId,r.amountPaise AS paise',{id});
        const amounts=new Map<string,{fromId:string;toId:string;groupId:string;paise:number}>();
        for(const edge of edges.records){const value={fromId:String(edge.get('fromId')),toId:String(edge.get('toId')),groupId:String(edge.get('groupId')),paise:neo4j.isInt(edge.get('paise'))?edge.get('paise').toNumber():Number(edge.get('paise'))};const key=`${value.groupId}:${value.fromId}:${value.toId}`;if(!amounts.has(key)||amounts.get(key)!.paise<value.paise)amounts.set(key,value)}
        await session.run('MATCH (u:User {id:$id})-[:MEMBER_OF]->(g:Group) WITH DISTINCT g MATCH (nodes:User {id:$id}) WITH g,nodes ORDER BY elementId(nodes) WITH g,collect(nodes)[0] AS keep MERGE (keep)-[:MEMBER_OF]->(g)',{id});
        await session.run('MATCH (a:User)-[r:OWES]->(b:User) WHERE a.id=$id OR b.id=$id DELETE r',{id});
        for(const edge of amounts.values())await session.run('MATCH (fromNode:User {id:$fromId}) WITH fromNode ORDER BY elementId(fromNode) WITH collect(fromNode)[0] AS a MATCH (toNode:User {id:$toId}) WITH a,toNode ORDER BY elementId(toNode) WITH a,collect(toNode)[0] AS b MERGE (a)-[r:OWES {groupId:$groupId}]->(b) SET r.amountPaise=$paise',edge);
        await session.run('MATCH (u:User {id:$id}) WITH u ORDER BY elementId(u) SKIP 1 DETACH DELETE u',{id});
      }
      // Merge group duplicates and retain membership links before deleting redundant nodes.
      const groups=await session.run('MATCH (n:Group) WHERE n.id IS NOT NULL WITH n.id AS id,collect(n) AS nodes WHERE size(nodes)>1 RETURN id ORDER BY id');
      for(const record of groups.records){const id=String(record.get('id'));const members=await session.run('MATCH (u:User)-[:MEMBER_OF]->(g:Group {id:$id}) RETURN DISTINCT u.id AS userId',{id});for(const member of members.records){const userId=String(member.get('userId'));await session.run('MATCH (g:Group {id:$groupId}) WITH g ORDER BY elementId(g) WITH collect(g)[0] AS keep MATCH (u:User {id:$userId}) WITH keep,u ORDER BY elementId(u) WITH keep,collect(u)[0] AS user MERGE (user)-[:MEMBER_OF]->(keep)',{groupId:id,userId})}await session.run('MATCH (g:Group {id:$id}) WITH g ORDER BY elementId(g) SKIP 1 DETACH DELETE g',{id})}
      await session.run('CREATE CONSTRAINT smartsplit_user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE');
      await session.run('CREATE CONSTRAINT smartsplit_group_id_unique IF NOT EXISTS FOR (g:Group) REQUIRE g.id IS UNIQUE');
      state.schemaReady=true;
    }finally{await session.close()}
  })();
  try{await state.schemaPromise}catch(error){state.schemaPromise=undefined;throw error}
}
export async function groupDebtPlan(groupId:string){
  const result=await db.query('SELECT user_id,user_name,balance::text,group_name FROM v_group_balances WHERE group_id=$1 ORDER BY user_name',[groupId]);
  const balances=result.rows as BalanceRow[];
  const byUser=Object.fromEntries(balances.map(row=>[row.user_id,Math.round(Number(row.balance)*100)]));
  const fallback=simplify(byUser);let neo:Driver|null=null;
  try{neo=driver()}catch(error){console.warn('Neo4j driver configuration is invalid; using TypeScript debt plan:',error instanceof Error?error.message:error)}
  if(!neo)return{available:false,source:'typescript' as const,balances,debts:fallback};
  const groupName=balances[0]?.group_name??groupId;
  const session=neo.session();
  try{
    await ensureGraphSchema(neo);
    await session.executeWrite(async tx=>{
      await tx.run('MERGE (g:Group {id:$id}) SET g.name=$name',{id:groupId,name:groupName});
      await tx.run(`UNWIND $members AS m
        MERGE (u:User {id:m.id}) SET u.name=m.name
        MERGE (g:Group {id:$groupId}) MERGE (u)-[:MEMBER_OF]->(g)`,
        {groupId,members:balances.map(row=>({id:row.user_id,name:row.user_name}))});
      await tx.run(`MATCH (u:User)-[m:MEMBER_OF]->(g:Group {id:$groupId})
        WHERE NOT u.id IN $memberIds DELETE m`,{groupId,memberIds:balances.map(row=>row.user_id)});
      await tx.run(`MATCH (:User)-[r:OWES {groupId:$groupId}]->(:User) DELETE r`,{groupId});
      await tx.run(`UNWIND $debts AS d
        MATCH (a:User {id:d.from}) MATCH (b:User {id:d.to})
        MERGE (a)-[r:OWES {groupId:$groupId}]->(b) SET r.amountPaise=d.paise`,
        {groupId,debts:fallback.map(debt=>({from:debt.from,to:debt.to,paise:debt.paise}))});
    });
    const graphDebts=await session.executeRead(async tx=>{
      const r=await tx.run(`MATCH (a:User)-[o:OWES {groupId:$groupId}]->(b:User)
        RETURN a.id AS from,a.name AS fromName,b.id AS to,b.name AS toName,o.amountPaise AS paise ORDER BY fromName,toName`,{groupId});
      return r.records.map(record=>({from:String(record.get('from')),fromName:String(record.get('fromName')),to:String(record.get('to')),toName:String(record.get('toName')),paise:neo4j.isInt(record.get('paise'))?record.get('paise').toNumber():Number(record.get('paise'))}));
    });
    return{available:true,source:'neo4j' as const,balances,debts:graphDebts};
  }catch(error){console.warn('Neo4j debt sync unavailable; serving TypeScript debt plan:',error instanceof Error?error.message:error);return{available:false,source:'typescript' as const,balances,debts:fallback}}
  finally{await session.close()}
}
export async function syncGroupGraph(groupId:string){const plan=await groupDebtPlan(groupId);return{available:plan.available,debts:plan.debts}}
export async function neo4jHealth(){let neo:Driver|null=null;try{neo=driver()}catch{return{available:false}}if(!neo)return{available:false};try{await neo.verifyConnectivity();return{available:true}}catch{return{available:false}}}
export async function removeGroupGraph(groupId:string){let neo:Driver|null=null;try{neo=driver()}catch{return false}if(!neo)return false;const session=neo.session();try{await session.executeWrite(tx=>tx.run('MATCH (g:Group {id:$id}) DETACH DELETE g',{id:groupId}));return true}catch{return false}finally{await session.close()}}

