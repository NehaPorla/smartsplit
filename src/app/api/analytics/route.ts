import {NextRequest} from 'next/server';import {db} from '@/lib/db';import {apiRoute,json,requireGroupMember,requireUser,uuidParam} from '@/lib/api';
export const GET=apiRoute(async(req:NextRequest)=>{
  const user=await requireUser(req),raw=req.nextUrl.searchParams.get('groupId'),groupId=raw?uuidParam(raw,'groupId'):null;
  if(groupId)await requireGroupMember(user.id,groupId);
  const params=[groupId,user.id,user.role==='admin'];
  const scope=`e.is_deleted=false AND ($1::uuid IS NULL OR e.group_id=$1) AND ($3::boolean OR EXISTS(SELECT 1 FROM group_members gm WHERE gm.group_id=e.group_id AND gm.user_id=$2))`;
  const [categories,monthly,spenders,totals,daily]=await Promise.all([
    db.query(`SELECT coalesce(c.name,'Other') AS category,sum(e.amount)::numeric(12,2) AS amount,count(*)::int AS expense_count FROM expenses e LEFT JOIN categories c ON c.id=e.category_id WHERE ${scope} GROUP BY c.name ORDER BY amount DESC`,params),
    db.query(`WITH m AS (SELECT date_trunc('month',e.expense_date)::date AS month,sum(e.amount)::numeric(12,2) AS amount FROM expenses e WHERE ${scope} GROUP BY 1) SELECT month AS month,amount AS amount,(amount-lag(amount) OVER(ORDER BY month)) AS change FROM m ORDER BY month`,params),
    db.query(`SELECT r.group_id,g.name AS group_name,r.user_id AS user_id,u.name AS user_name,r.total_paid AS total_paid,r.spender_rank AS spender_rank FROM v_group_spend_ranking r JOIN groups g ON g.id=r.group_id JOIN users u ON u.id=r.user_id WHERE ($1::uuid IS NULL OR r.group_id=$1) AND ($3::boolean OR EXISTS(SELECT 1 FROM group_members gm WHERE gm.group_id=r.group_id AND gm.user_id=$2)) AND r.spender_rank<=5 ORDER BY r.spender_rank,r.total_paid DESC`,params),
    db.query(`SELECT count(*)::int AS expense_count,coalesce(sum(e.amount),0)::numeric(12,2) AS total_spend,coalesce(avg(e.amount),0)::numeric(12,2) AS average_expense FROM expenses e WHERE ${scope}`,params),
    db.query(`SELECT e.expense_date::date AS day,sum(e.amount)::numeric(12,2) AS amount FROM expenses e WHERE ${scope} AND e.expense_date>=date_trunc('month',current_date)::date AND e.expense_date<date_trunc('month',current_date)::date+interval '1 month' GROUP BY e.expense_date::date ORDER BY day`,params),
  ]);
  return json({summary:totals.rows[0],categorySpend:categories.rows,monthlyTrend:monthly.rows,dailyTrend:daily.rows,topSpenders:spenders.rows});
});


