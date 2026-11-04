import bcrypt from 'bcryptjs';
import { Pool, type PoolClient } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const users = [
  { id:'00000000-0000-4000-8000-000000000001', name:'SmartSplit Admin', email:'admin@smartsplit.local', role:'admin' as const, password:'SplitAdmin!2026' },
  { id:'00000000-0000-4000-8000-000000000002', name:'Aarav Mehta', email:'member@smartsplit.local', role:'member' as const, password:'SplitMember!2026' },
  { id:'00000000-0000-4000-8000-000000000003', name:'Diya Rao', email:'diya@smartsplit.local', role:'member' as const, password:'SplitMember!2026' },
  { id:'00000000-0000-4000-8000-000000000004', name:'Kabir Shah', email:'kabir@smartsplit.local', role:'member' as const, password:'SplitMember!2026' },
  { id:'00000000-0000-4000-8000-000000000005', name:'Anaya Iyer', email:'anaya@smartsplit.local', role:'member' as const, password:'SplitMember!2026' },
  { id:'00000000-0000-4000-8000-000000000006', name:'Vivaan Nair', email:'vivaan@smartsplit.local', role:'member' as const, password:'SplitMember!2026' },
  { id:'00000000-0000-4000-8000-000000000007', name:'Neha', email:'neha@example.com', role:'member' as const, password:'NehaSplit!2026' },
];
const groups = [
  { id:'20000000-0000-4000-8000-000000000001', name:'Goa Getaway', users:[0,1,2,3,6] },
  { id:'20000000-0000-4000-8000-000000000002', name:'Apartment 4B', users:[0,1,3,4] },
  { id:'20000000-0000-4000-8000-000000000003', name:'Weekend Crew', users:[0,1,4,5,6] },
];
const categories = ['Food','Travel','Rent','Utilities','Entertainment'];
const uuid = (number:number) => `30000000-0000-4000-8000-${number.toString().padStart(12,'0')}`;
const centsString = (cents:number) => `${Math.floor(cents/100)}.${String(cents%100).padStart(2,'0')}`;

async function createGroupExpenses(client:PoolClient, groupIndex:number, categoryIds:Map<string,number>) {
  const group=groups[groupIndex], memberIds=group.users.map(i=>users[i].id);
  for(let i=0;i<15;i++){
    const expenseNo=groupIndex*15+i+1, cents=18500+((expenseNo*1783+groupIndex*911)%42700);
    const payer=memberIds[(i+groupIndex)%memberIds.length];
    const category=categories[(i+groupIndex)%categories.length];
    const titles=['Shared dinner','Taxi to the beach','Market groceries','Weekend booking','Coffee and snacks','Fuel stop','Group supplies','Museum tickets','Utilities bill','Lunch together'];
    const date=new Date(Date.now()-((45-i*2+groupIndex*3)*86400000)).toISOString().slice(0,10);
    const expense=await client.query(
      `INSERT INTO expenses(id,group_id,paid_by,title,amount,category_id,expense_date,split_type,notes)
       VALUES($1,$2,$3,$4,$5,$6,$7,'equal',$8) RETURNING id`,
      [uuid(expenseNo),group.id,payer,`${titles[(i+groupIndex)%titles.length]} #${String(expenseNo).padStart(2,'0')}`,centsString(cents),categoryIds.get(category),date,`Demo ${category.toLowerCase()} shared expense`]);
    const base=Math.floor(cents/memberIds.length), remainder=cents%memberIds.length;
    for(let m=0;m<memberIds.length;m++){
      const share=base+(m<remainder?1:0);
      await client.query('INSERT INTO expense_splits(expense_id,user_id,share_amount) VALUES($1,$2,$3)',[expense.rows[0].id,memberIds[m],centsString(share)]);
    }
  }
}

async function addSettlements(client:PoolClient){
  for(const group of groups){
    const balances=(await client.query('SELECT user_id,balance::text FROM get_group_balances($1)',[group.id])).rows
      .map(r=>({id:String(r.user_id),cents:Math.round(Number(r.balance)*100)}));
    // Keep some debt outstanding so the seed demonstrates both settlement history and a live debt graph.
    const debtor=balances.find(b=>b.cents<0),creditor=balances.find(b=>b.cents>0);
    if(debtor&&creditor){
      const amount=Math.max(1,Math.floor(Math.min(-debtor.cents,creditor.cents)/3));
      await client.query('SELECT settle_up($1,$2,$3,$4,$5)',[group.id,debtor.id,creditor.id,centsString(amount),'Seed demo partial settlement']);
    }
  }
}

async function main(){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const passwordHashes=await Promise.all(users.map(u=>bcrypt.hash(u.password,12)));
    for(let i=0;i<users.length;i++){
      const u=users[i];
      await client.query(`INSERT INTO users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)
        ON CONFLICT(email) DO UPDATE SET name=excluded.name,password_hash=excluded.password_hash,role=excluded.role`,[u.id,u.name,u.email,passwordHashes[i],u.role]);
    }
    for(const name of categories) await client.query('INSERT INTO categories(name) VALUES($1) ON CONFLICT(name) DO NOTHING',[name]);
    const categoryRows=await client.query('SELECT id,name FROM categories WHERE name=ANY($1::text[])',[categories]);
    const categoryIds=new Map<string,number>();
    for(const row of categoryRows.rows) categoryIds.set(String(row.name),Number(row.id));
    for(const group of groups){
      await client.query(`INSERT INTO groups(id,name,description,currency,created_by) VALUES($1,$2,$3,'INR',$4)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,created_by=excluded.created_by`,[group.id,group.name,`SmartSplit demo group: ${group.name}`,users[0].id]);
      await client.query('DELETE FROM settlements WHERE group_id=$1',[group.id]);
      await client.query('DELETE FROM expenses WHERE group_id=$1',[group.id]);
      await client.query('DELETE FROM group_members WHERE group_id=$1',[group.id]);
      for(const index of group.users){
        await client.query(`INSERT INTO group_members(group_id,user_id,member_role) VALUES($1,$2,$3)
          ON CONFLICT(group_id,user_id) DO UPDATE SET member_role=excluded.member_role`,[group.id,users[index].id,index===0?'owner':'member']);
      }
    }
    for(let g=0;g<groups.length;g++) await createGroupExpenses(client,g,categoryIds);
    await addSettlements(client);
    const counts=await client.query(`SELECT (SELECT count(*) FROM users WHERE id=ANY($2::uuid[])) users,
      (SELECT count(*) FROM groups WHERE id=ANY($1::uuid[])) groups,
      (SELECT count(*) FROM expenses WHERE group_id=ANY($1::uuid[])) expenses,
      (SELECT count(*) FROM settlements WHERE group_id=ANY($1::uuid[])) settlements`,[groups.map(g=>g.id),users.map(u=>u.id)]);
    await client.query('COMMIT');
    console.log(`Seed complete: ${counts.rows[0].users} users, ${counts.rows[0].groups} demo groups, ${counts.rows[0].expenses} expenses, ${counts.rows[0].settlements} settlements.`);
    console.log('Demo credentials (change these passwords after your demo):');
    console.log(`Admin:  ${users[0].email} / ${users[0].password}`);
    console.log(`Member: ${users[1].email} / ${users[1].password}`);
    console.log(`Neha:   ${users[6].email} / ${users[6].password}`);
  }catch(error){await client.query('ROLLBACK');throw error}
  finally{client.release();await pool.end()}
}

main().catch(error=>{console.error('Seed failed:',error instanceof Error?error.message:error);process.exitCode=1});
