import {Pool} from 'pg';

const pool=new Pool({connectionString:process.env.DATABASE_URL});
const demoGroups=['20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003'];
function assert(condition:boolean,message:string){if(!condition)throw new Error(`FAIL: ${message}`);console.log(`PASS: ${message}`)}

async function main(){
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
  try{
    const counts=await pool.query(`SELECT
      (SELECT count(*) FROM users WHERE id BETWEEN '00000000-0000-4000-8000-000000000001'::uuid AND '00000000-0000-4000-8000-000000000007'::uuid) users,
      (SELECT count(*) FROM group_members WHERE user_id='00000000-0000-4000-8000-000000000007') neha_groups,
      (SELECT count(*) FROM groups WHERE id=ANY($1::uuid[])) groups,
      (SELECT count(*) FROM expenses WHERE group_id=ANY($1::uuid[])) expenses,
      (SELECT count(*) FROM expense_splits s JOIN expenses e ON e.id=s.expense_id WHERE e.group_id=ANY($1::uuid[])) splits,
      (SELECT count(*) FROM settlements WHERE group_id=ANY($1::uuid[])) settlements`,[demoGroups]);
    const c=counts.rows[0];
    assert(Number(c.users)>=7,'at least seven deterministic demo users exist, including Neha');
    assert(Number(c.neha_groups)===2,'Neha belongs to exactly two demo groups');
    assert(Number(c.groups)===3,'three demo groups exist');
    assert(Number(c.expenses)>=40,'at least forty demo expenses exist');
    assert(Number(c.splits)>=40,'expenses have persisted split rows');
    assert(Number(c.settlements)>0,'demo settlement records exist');

    const integrity=await pool.query(`SELECT
      (SELECT count(*) FROM v_balance_reconciliation WHERE NOT matches) balance_mismatches,
      (SELECT count(*) FROM (SELECT e.id FROM expenses e LEFT JOIN expense_splits s ON s.expense_id=e.id WHERE e.group_id=ANY($1::uuid[]) GROUP BY e.id,e.amount HAVING coalesce(sum(s.share_amount),0)<>e.amount) invalid) bad_splits,
      (SELECT count(*) FROM groups g CROSS JOIN LATERAL simplify_debts_preview(g.id) WHERE g.id=ANY($1::uuid[])) debt_transfers,
      (SELECT count(*) FROM expenses WHERE group_id=ANY($1::uuid[]) AND search_doc @@ plainto_tsquery('english','dinner')) full_text_hits`,[demoGroups]);
    const q=integrity.rows[0];
    assert(Number(q.balance_mismatches)===0,'trigger-maintained balances match the calculated balance view');
    assert(Number(q.bad_splits??0)===0,'every demo expense split sums to its expense amount');
    assert(Number(q.debt_transfers)>0,'SQL debt simplification returns live demo transfers');
    assert(Number(q.full_text_hits)>0,'generated tsvector full-text search finds seeded expenses');

    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      await client.query('SAVEPOINT invalid_split_test');
      let rejected=false;
      try{
        await client.query(`SELECT add_expense_with_splits($1,$2,'Invalid split test',10.00,$3,'exact',
          jsonb_build_array(jsonb_build_object('user_id',$4::text,'share_amount',9.00)))`,
          [demoGroups[0],'00000000-0000-4000-8000-000000000001',1,'00000000-0000-4000-8000-000000000002']);
      }catch(error){rejected=error instanceof Error&&error.message.includes('Split total');}
      await client.query('ROLLBACK TO SAVEPOINT invalid_split_test');
      assert(rejected,'database function rejects mismatched split totals');
      await client.query('ROLLBACK');
    }finally{client.release()}
    console.log('Database verification completed.');
  }finally{await pool.end()}
}
main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=1});
