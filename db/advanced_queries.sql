-- 1. INNER JOIN + LEFT JOIN: active expenses with payer and optional category.
SELECT e.id,e.title,u.name AS payer,coalesce(c.name,'Uncategorized') AS category,e.amount
FROM expenses e INNER JOIN users u ON u.id=e.paid_by
LEFT JOIN categories c ON c.id=e.category_id
WHERE NOT e.is_deleted ORDER BY e.expense_date DESC,e.created_at DESC LIMIT 25;

-- 2. SELF JOIN: unique pairs of members who share a group.
SELECT g.name AS group_name,u1.name AS member_a,u2.name AS member_b
FROM group_members gm1 JOIN group_members gm2 ON gm1.group_id=gm2.group_id AND gm1.user_id<gm2.user_id
JOIN groups g ON g.id=gm1.group_id JOIN users u1 ON u1.id=gm1.user_id JOIN users u2 ON u2.id=gm2.user_id
ORDER BY g.name,member_a,member_b;

-- 3. GROUP BY / HAVING / ORDER BY with SUM, AVG, COUNT, MIN, MAX: identify high-spend groups.
SELECT g.id,g.name,count(e.id) AS expense_count,coalesce(sum(e.amount),0)::numeric(12,2) AS spend,
       coalesce(avg(e.amount),0)::numeric(12,2) AS average_expense,min(e.amount) AS smallest,max(e.amount) AS largest
FROM groups g LEFT JOIN expenses e ON e.group_id=g.id AND NOT e.is_deleted
GROUP BY g.id,g.name HAVING coalesce(sum(e.amount),0)>1000 ORDER BY spend DESC;

-- 4. Correlated subquery: find each group's largest expense(s).
SELECT e.group_id,e.title,e.amount FROM expenses e
WHERE NOT e.is_deleted AND e.amount=(SELECT max(x.amount) FROM expenses x WHERE x.group_id=e.group_id AND NOT x.is_deleted)
ORDER BY e.group_id;

-- 5. Uncorrelated subquery: active expenses above the platform-wide average.
SELECT id,title,amount FROM expenses WHERE NOT is_deleted AND amount>(SELECT avg(amount) FROM expenses WHERE NOT is_deleted) ORDER BY amount DESC;

-- 6. Views: compare trigger-maintained balances with balances calculated from ledger rows.
SELECT * FROM v_balance_reconciliation WHERE NOT matches ORDER BY group_id,user_id;
SELECT group_name,user_name,balance FROM v_group_balances ORDER BY group_name,user_name;

-- 7. Window function RANK: leading payers in each group.
SELECT g.name AS group_name,u.name AS payer,r.total_paid,r.spender_rank
FROM v_group_spend_ranking r JOIN groups g ON g.id=r.group_id JOIN users u ON u.id=r.user_id
WHERE r.spender_rank<=3 ORDER BY group_name,r.spender_rank,payer;

-- 8. CTE + window running sum and LAG: month totals and month-over-month change.
WITH monthly AS (
  SELECT date_trunc('month',expense_date)::date AS month,sum(amount)::numeric(12,2) AS total
  FROM expenses WHERE NOT is_deleted GROUP BY 1
)
SELECT month,total,sum(total) OVER(ORDER BY month) AS running_total,
       total-lag(total) OVER(ORDER BY month) AS change_from_previous_month
FROM monthly ORDER BY month;

-- 9. Full-text search: title and notes ranked by relevance; search_doc has a GIN index.
SELECT id,title,notes,ts_rank(search_doc,plainto_tsquery('english','dinner beach')) AS relevance
FROM expenses WHERE NOT is_deleted AND search_doc @@ plainto_tsquery('english','dinner beach')
ORDER BY relevance DESC,expense_date DESC LIMIT 20;

-- 10. Recursive CTE: explore settlement chains without revisiting a user in a path.
WITH RECURSIVE paths(group_id,origin,current_user_id,path,depth) AS (
  SELECT group_id,from_user,to_user,ARRAY[from_user,to_user],1 FROM settlements
  UNION ALL
  SELECT p.group_id,p.origin,s.to_user,p.path||s.to_user,p.depth+1
  FROM paths p JOIN settlements s ON s.group_id=p.group_id AND s.from_user=p.current_user_id
  WHERE p.depth<6 AND NOT s.to_user=ANY(p.path)
)
SELECT g.name AS group_name,u1.name AS origin,u2.name AS destination,p.path AS path,p.depth AS depth FROM paths p
JOIN groups g ON g.id=p.group_id JOIN users u1 ON u1.id=p.origin JOIN users u2 ON u2.id=p.current_user_id ORDER BY g.name,depth;

-- 11. Procedure/function query: SQL-side greedy settlement preview per group.
SELECT g.name AS group_name,d.from_name AS from_name,d.to_name AS to_name,d.amount AS amount FROM groups g CROSS JOIN LATERAL simplify_debts_preview(g.id) d ORDER BY g.name,d.amount DESC;

-- 12. Index demonstration: compare planner output for the common active expense timeline query.
EXPLAIN (ANALYZE,BUFFERS) SELECT id,title,amount,expense_date FROM expenses
WHERE group_id='20000000-0000-4000-8000-000000000001' AND NOT is_deleted
ORDER BY expense_date DESC LIMIT 20;

