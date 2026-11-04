import {NextRequest} from 'next/server';import {db} from '@/lib/db';import {apiRoute,json,requireGroupMember,requireUser,uuidParam} from '@/lib/api';import {groupDebtPlan} from '@/lib/sync';
type Context={params:{groupId:string}};
export const GET=apiRoute(async(req:NextRequest,ctx)=>{
  const user=await requireUser(req),groupId=uuidParam((ctx as Context|undefined)?.params.groupId,'groupId');await requireGroupMember(user.id,groupId);
  const [plan,original]=await Promise.all([
    groupDebtPlan(groupId),
    db.query(`WITH raw AS (
      SELECT s.user_id AS debtor,e.paid_by AS creditor,s.share_amount AS amount
      FROM expense_splits s JOIN expenses e ON e.id=s.expense_id
      WHERE e.group_id=$1 AND NOT e.is_deleted AND s.user_id<>e.paid_by
      UNION ALL SELECT from_user,to_user,-amount FROM settlements WHERE group_id=$1
    ),pairs AS (
      SELECT least(debtor,creditor) AS low_id,greatest(debtor,creditor) AS high_id,
        sum(CASE WHEN debtor<creditor THEN amount ELSE -amount END) AS signed_amount
      FROM raw GROUP BY least(debtor,creditor),greatest(debtor,creditor)
    )
    SELECT CASE WHEN signed_amount>0 THEN low_id ELSE high_id END AS from_user,
      CASE WHEN signed_amount>0 THEN high_id ELSE low_id END AS to_user,
      abs(signed_amount)::numeric(12,2) AS amount
    FROM pairs WHERE signed_amount<>0 ORDER BY amount DESC`,[groupId]),
  ]);
  const positive=plan.balances.filter(b=>Number(b.balance)>0).reduce((s,b)=>s+Number(b.balance),0),negative=plan.balances.filter(b=>Number(b.balance)<0).reduce((s,b)=>s+Number(b.balance),0);
  return json({balances:plan.balances.map(b=>({...b,youOwe:Number(b.balance)<0?(-Number(b.balance)).toFixed(2):'0.00',youAreOwed:Number(b.balance)>0?Number(b.balance).toFixed(2):'0.00'})),originalDebts:original.rows,simplifiedDebts:plan.debts,transactionsSaved:Math.max(0,original.rows.length-plan.debts.length),totalOwed:positive.toFixed(2),totalDue:(-negative).toFixed(2),neo4j:{available:plan.available,source:plan.source,notice:plan.available?null:'Neo4j is unavailable; the TypeScript greedy algorithm supplied the settlement plan'}});
});
