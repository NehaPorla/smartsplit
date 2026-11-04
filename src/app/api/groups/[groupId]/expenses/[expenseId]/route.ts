import {NextRequest} from 'next/server';import {db} from '@/lib/db';import {ApiError,apiRoute,json,readJson,requireGroupMember,requireUser,uuidParam} from '@/lib/api';import {expenseSchema,makeSplitRows,splitItemsFor} from '@/lib/expense-api';import {transaction} from '@/lib/transaction';import {syncGroupGraph} from '@/lib/sync';import {expenseEmbedding,pgVector} from '@/lib/embedding';
type Context={params:{groupId:string;expenseId:string}};
const patchSchema=expenseSchema.partial().strict().refine(v=>Object.keys(v).length>0);
async function authorize(req:NextRequest,ctx:Context){const user=await requireUser(req),groupId=uuidParam(ctx.params.groupId,'groupId'),expenseId=uuidParam(ctx.params.expenseId,'expenseId'),membership=await requireGroupMember(user.id,groupId);const r=await db.query('SELECT paid_by FROM expenses WHERE id=$1 AND group_id=$2 AND NOT is_deleted',[expenseId,groupId]);if(!r.rowCount)throw new ApiError(404,'EXPENSE_NOT_FOUND','Expense not found');if(r.rows[0].paid_by!==user.id&&membership.member_role!=='owner'&&user.role!=='admin')throw new ApiError(403,'FORBIDDEN','Only the payer, group owner, or administrator can edit this expense');return{user,groupId,expenseId}};
export const PATCH=apiRoute(async(req:NextRequest,rawCtx)=>{
  const ctx=rawCtx as Context,auth=await authorize(req,ctx),body=await readJson(req,patchSchema);
  const id=await transaction(async client=>{
    await client.query('SELECT id FROM groups WHERE id=$1 FOR UPDATE',[auth.groupId]);
    const current=await client.query('SELECT e.* FROM expenses e WHERE e.id=$1 AND e.group_id=$2 AND NOT e.is_deleted FOR UPDATE',[auth.expenseId,auth.groupId]);
    if(!current.rowCount)throw new ApiError(404,'EXPENSE_NOT_FOUND','Expense not found');const old=current.rows[0];
    const amount=body.amount??String(old.amount),type=body.splitType??old.split_type;
    if(body.amount!==undefined&&body.splits===undefined)throw new ApiError(400,'SPLITS_REQUIRED','Provide replacement splits when changing the amount');
    if(body.splitType!==undefined&&body.splits===undefined)throw new ApiError(400,'SPLITS_REQUIRED','Provide replacement splits when changing the split type');
    const splitRows=body.splits?makeSplitRows(type,amount,splitItemsFor(type,body.splits)):null;
    await client.query(`UPDATE expenses SET title=coalesce($3,title),amount=$4,paid_by=coalesce($5,paid_by),category_id=CASE WHEN $6 THEN $7::smallint ELSE category_id END,expense_date=coalesce($8::date,expense_date),split_type=$9,notes=coalesce($10,notes) WHERE id=$1 AND group_id=$2`,[auth.expenseId,auth.groupId,body.title??null,amount,body.paidBy??null,body.categoryId!==undefined,body.categoryId??null,body.expenseDate??null,type,body.notes??null]);
    if(splitRows){await client.query('DELETE FROM expense_splits WHERE expense_id=$1',[auth.expenseId]);for(const split of splitRows)await client.query('INSERT INTO expense_splits(expense_id,user_id,share_amount) VALUES($1,$2,$3)',[auth.expenseId,split.user_id,split.share_amount])}
    if(process.env.ENABLE_VECTOR==='true'&&body.embedding){await client.query('INSERT INTO expense_vectors(expense_id,embedding,model) VALUES($1,$2::vector,$3) ON CONFLICT(expense_id) DO UPDATE SET embedding=excluded.embedding,model=excluded.model,created_at=now()',[auth.expenseId,`[${body.embedding.join(',')}]`,'client-supplied-384d'])}
    else if(process.env.ENABLE_VECTOR==='true'&&(body.title!==undefined||body.notes!==undefined))await client.query('DELETE FROM expense_vectors WHERE expense_id=$1',[auth.expenseId]);
    return auth.expenseId;
  },auth.user.id);
  const graph=await syncGroupGraph(auth.groupId);return json({expenseId:id,updated:true,neo4jAvailable:graph.available,notice:graph.available?undefined:'Neo4j unavailable; debt graph will use the TypeScript fallback'});
});
export const DELETE=apiRoute(async(req:NextRequest,rawCtx)=>{const auth=await authorize(req,rawCtx as Context);const deleted=await transaction(async c=>{const r=await c.query('UPDATE expenses SET is_deleted=true WHERE id=$1 AND group_id=$2 RETURNING id',[auth.expenseId,auth.groupId]);return Boolean(r.rowCount)},auth.user.id);const graph=await syncGroupGraph(auth.groupId);return json({deleted,neo4jAvailable:graph.available})});
export const GET=apiRoute(async(req:NextRequest,rawCtx)=>{const user=await requireUser(req),ctx=rawCtx as Context,groupId=uuidParam(ctx.params.groupId,'groupId'),expenseId=uuidParam(ctx.params.expenseId,'expenseId');await requireGroupMember(user.id,groupId);const r=await db.query('SELECT * FROM v_expense_details WHERE id=$1 AND group_id=$2 AND NOT is_deleted',[expenseId,groupId]);if(!r.rowCount)throw new ApiError(404,'EXPENSE_NOT_FOUND','Expense not found');const s=await db.query('SELECT s.user_id,u.name,s.share_amount FROM expense_splits s JOIN users u ON u.id=s.user_id WHERE s.expense_id=$1 ORDER BY u.name',[expenseId]);return json({expense:r.rows[0],splits:s.rows})});

