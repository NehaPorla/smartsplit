CREATE OR REPLACE VIEW v_group_balances AS
SELECT g.id AS group_id,g.name AS group_name,b.user_id,b.name AS user_name,b.balance
FROM groups g CROSS JOIN LATERAL get_group_balances(g.id) b;

CREATE OR REPLACE VIEW v_user_net_balance AS
SELECT user_id,user_name,sum(balance)::numeric(12,2) AS net_balance
FROM v_group_balances GROUP BY user_id,user_name;

CREATE OR REPLACE VIEW v_expense_details AS
SELECT e.id,e.group_id,g.name AS group_name,e.paid_by,u.name AS payer_name,e.title,e.amount,
       e.category_id,c.name AS category_name,e.expense_date,e.split_type,e.notes,e.search_doc,e.created_at,e.is_deleted,
       count(s.user_id)::integer AS split_count,coalesce(sum(s.share_amount),0)::numeric(12,2) AS split_total
FROM expenses e JOIN groups g ON g.id=e.group_id JOIN users u ON u.id=e.paid_by
LEFT JOIN categories c ON c.id=e.category_id LEFT JOIN expense_splits s ON s.expense_id=e.id
GROUP BY e.id,g.name,u.name,c.name;

CREATE OR REPLACE VIEW v_monthly_category_spend AS
SELECT date_trunc('month',e.expense_date)::date AS month,coalesce(c.name,'Other') AS category,
       sum(e.amount)::numeric(12,2) AS total,count(*)::integer AS expense_count
FROM expenses e LEFT JOIN categories c ON c.id=e.category_id
WHERE NOT e.is_deleted GROUP BY 1,2;

CREATE OR REPLACE VIEW v_balance_reconciliation AS
SELECT coalesce(calc.group_id,stored.group_id) AS group_id,
       coalesce(calc.user_id,stored.user_id) AS user_id,
       coalesce(calc.balance,0)::numeric(12,2) AS calculated_balance,
       coalesce(stored.balance,0)::numeric(12,2) AS trigger_balance,
       (coalesce(calc.balance,0)=coalesce(stored.balance,0)) AS matches
FROM (SELECT group_id,user_id,balance FROM v_group_balances) calc
FULL JOIN group_balances stored USING(group_id,user_id);

CREATE OR REPLACE VIEW v_group_spend_ranking AS
SELECT group_id,user_id,user_name,total_paid,
       rank() OVER(PARTITION BY group_id ORDER BY total_paid DESC) AS spender_rank
FROM (SELECT e.group_id,e.paid_by AS user_id,u.name AS user_name,sum(e.amount)::numeric(12,2) AS total_paid
      FROM expenses e JOIN users u ON u.id=e.paid_by WHERE NOT e.is_deleted
      GROUP BY e.group_id,e.paid_by,u.name) q;
