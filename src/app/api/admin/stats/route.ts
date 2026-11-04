import {NextRequest} from 'next/server';import {db} from '@/lib/db';import {apiRoute,json,requireAdmin,requireUser} from '@/lib/api';
export const GET=apiRoute(async(req:NextRequest)=>{const user=await requireUser(req);requireAdmin(user);const [summary,groups,months,activity]=await Promise.all([
 db.query(`WITH spend AS (SELECT count(*) AS expense_count,coalesce(sum(amount),0)::numeric(12,2) AS total_spend FROM expenses WHERE NOT is_deleted),member_count AS (SELECT count(*) AS users FROM users),group_count AS (SELECT count(*) AS groups FROM groups),settlement_count AS (SELECT count(*) AS settlements FROM settlements) SELECT * FROM spend CROSS JOIN member_count CROSS JOIN group_count CROSS JOIN settlement_count`),
 db.query(`SELECT g.id,g.name,coalesce(m.members,0)::int AS members,coalesce(e.expenses,0)::int AS expenses,coalesce(e.spend,0)::numeric(12,2) AS spend FROM groups g LEFT JOIN LATERAL (SELECT count(*) AS members FROM group_members WHERE group_id=g.id) m ON true LEFT JOIN LATERAL (SELECT count(*) AS expenses,sum(amount) AS spend FROM expenses WHERE group_id=g.id AND NOT is_deleted) e ON true ORDER BY spend DESC LIMIT 10`),
 db.query(`WITH m AS (SELECT date_trunc('month',expense_date)::date AS month,sum(amount)::numeric(12,2) AS spend FROM expenses WHERE NOT is_deleted GROUP BY 1) SELECT month AS month,spend AS spend,(spend-lag(spend) OVER(ORDER BY month)) AS change FROM m ORDER BY month`),
 db.query(`SELECT table_name AS table_name,operation AS operation,count(*)::int AS event_count FROM audit_log WHERE changed_at>=now()-interval '30 days' GROUP BY table_name,operation ORDER BY event_count DESC LIMIT 10`),
]);return json({summary:summary.rows[0],topGroups:groups.rows,monthlySpend:months.rows,recentAuditActivity:activity.rows})});


