CREATE OR REPLACE FUNCTION get_group_balances(p_group uuid)
RETURNS TABLE(user_id uuid,name text,balance numeric)
LANGUAGE sql STABLE AS $$
  SELECT u.id,u.name,coalesce(sum(x.delta),0)::numeric(12,2)
  FROM group_members gm JOIN users u ON u.id=gm.user_id
  LEFT JOIN (
    SELECT e.group_id,e.paid_by AS user_id,e.amount AS delta FROM expenses e WHERE NOT e.is_deleted
    UNION ALL SELECT e.group_id,s.user_id,-s.share_amount FROM expense_splits s JOIN expenses e ON e.id=s.expense_id WHERE NOT e.is_deleted
    UNION ALL SELECT group_id,from_user,amount FROM settlements
    UNION ALL SELECT group_id,to_user,-amount FROM settlements
  ) x ON x.group_id=gm.group_id AND x.user_id=gm.user_id
  WHERE gm.group_id=p_group GROUP BY u.id,u.name ORDER BY u.name
$$;

CREATE OR REPLACE FUNCTION add_expense_with_splits(
  p_group uuid,p_payer uuid,p_title text,p_amount numeric,p_category smallint,p_type text,p_splits jsonb
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE eid uuid; split_total numeric;
BEGIN
  IF p_amount IS NULL OR p_amount<=0 OR p_amount<>round(p_amount,2) THEN RAISE EXCEPTION 'Expense amount must be positive with at most two decimals'; END IF;
  IF p_type NOT IN ('equal','exact','percentage','shares') THEN RAISE EXCEPTION 'Unsupported split type'; END IF;
  PERFORM 1 FROM groups WHERE id=p_group FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Group not found'; END IF;
  IF NOT EXISTS(SELECT 1 FROM group_members WHERE group_id=p_group AND user_id=p_payer) THEN RAISE EXCEPTION 'Payer must be a group member'; END IF;
  IF jsonb_typeof(p_splits)<>'array' OR jsonb_array_length(p_splits)=0 THEN RAISE EXCEPTION 'At least one split is required'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_splits) v WHERE NOT (v ? 'user_id') OR NOT (v ? 'share_amount') OR (v->>'share_amount')::numeric<0) THEN RAISE EXCEPTION 'Each split requires a valid user_id and non-negative share_amount'; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(p_splits))<>(SELECT count(DISTINCT (v->>'user_id')::uuid) FROM jsonb_array_elements(p_splits) v) THEN RAISE EXCEPTION 'Duplicate split participants are not allowed'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_splits) v WHERE NOT EXISTS(SELECT 1 FROM group_members gm WHERE gm.group_id=p_group AND gm.user_id=(v->>'user_id')::uuid)) THEN RAISE EXCEPTION 'Every split participant must belong to the group'; END IF;
  SELECT sum((v->>'share_amount')::numeric) INTO split_total FROM jsonb_array_elements(p_splits) v;
  IF split_total<>p_amount THEN RAISE EXCEPTION 'Split total % does not equal expense %',split_total,p_amount; END IF;
  INSERT INTO expenses(group_id,paid_by,title,amount,category_id,split_type) VALUES(p_group,p_payer,p_title,p_amount,p_category,p_type) RETURNING id INTO eid;
  INSERT INTO expense_splits(expense_id,user_id,share_amount) SELECT eid,(v->>'user_id')::uuid,(v->>'share_amount')::numeric FROM jsonb_array_elements(p_splits) v;
  RETURN eid;
END $$;

CREATE OR REPLACE FUNCTION settle_up(p_group uuid,p_from uuid,p_to uuid,p_amount numeric,p_note text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE sid uuid; from_balance numeric; to_balance numeric;
BEGIN
  IF p_from=p_to OR p_amount IS NULL OR p_amount<=0 OR p_amount<>round(p_amount,2) THEN RAISE EXCEPTION 'Settlement must be positive cents between different users'; END IF;
  PERFORM 1 FROM groups WHERE id=p_group FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Group not found'; END IF;
  SELECT b.balance INTO from_balance FROM get_group_balances(p_group) b WHERE b.user_id=p_from;
  SELECT b.balance INTO to_balance FROM get_group_balances(p_group) b WHERE b.user_id=p_to;
  IF from_balance IS NULL OR to_balance IS NULL THEN RAISE EXCEPTION 'Settlement users must be group members'; END IF;
  IF from_balance>=0 OR to_balance<=0 THEN RAISE EXCEPTION 'Settlement must go from a debtor to a creditor'; END IF;
  IF p_amount>least(-from_balance,to_balance) THEN RAISE EXCEPTION 'Settlement exceeds the outstanding debt'; END IF;
  INSERT INTO settlements(group_id,from_user,to_user,amount,note) VALUES(p_group,p_from,p_to,p_amount,coalesce(p_note,'')) RETURNING id INTO sid;
  RETURN sid;
END $$;

CREATE OR REPLACE FUNCTION simplify_debts_preview(p_group uuid)
RETURNS TABLE(from_user uuid,from_name text,to_user uuid,to_name text,amount numeric)
LANGUAGE plpgsql STABLE AS $$
DECLARE debtors uuid[]; debt_names text[]; debtor_left numeric[]; creditors uuid[]; creditor_names text[]; creditor_left numeric[]; i integer:=1; j integer:=1; transfer numeric;
BEGIN
  SELECT array_agg(user_id ORDER BY balance),array_agg(name ORDER BY balance),array_agg(-balance ORDER BY balance)
    INTO debtors,debt_names,debtor_left FROM get_group_balances(p_group) WHERE balance<0;
  SELECT array_agg(user_id ORDER BY balance DESC),array_agg(name ORDER BY balance DESC),array_agg(balance ORDER BY balance DESC)
    INTO creditors,creditor_names,creditor_left FROM get_group_balances(p_group) WHERE balance>0;
  IF debtors IS NULL OR creditors IS NULL THEN RETURN; END IF;
  WHILE i<=cardinality(debtors) AND j<=cardinality(creditors) LOOP
    transfer:=least(debtor_left[i],creditor_left[j]);
    from_user:=debtors[i]; from_name:=debt_names[i]; to_user:=creditors[j]; to_name:=creditor_names[j]; amount:=transfer; RETURN NEXT;
    debtor_left[i]:=debtor_left[i]-transfer; creditor_left[j]:=creditor_left[j]-transfer;
    IF debtor_left[i]=0 THEN i:=i+1; END IF; IF creditor_left[j]=0 THEN j:=j+1; END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION run_recurring_expenses()
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer:=0; r recurring_expenses; split_json jsonb;
BEGIN
  FOR r IN SELECT * FROM recurring_expenses WHERE active AND next_run<=CURRENT_DATE ORDER BY next_run FOR UPDATE LOOP
    WITH members AS (SELECT user_id,row_number() OVER(ORDER BY user_id) AS rn,count(*) OVER() AS cnt FROM group_members WHERE group_id=r.group_id)
    SELECT jsonb_agg(jsonb_build_object('user_id',user_id,'share_amount',((floor(r.amount*100/cnt)+(CASE WHEN rn<=mod(round(r.amount*100)::integer,cnt) THEN 1 ELSE 0 END))/100.0)::numeric(12,2)) ORDER BY user_id) INTO split_json FROM members;
    PERFORM add_expense_with_splits(r.group_id,r.paid_by,r.title,r.amount,r.category_id,'equal',split_json);
    UPDATE recurring_expenses SET next_run=(next_run+interval '1 month')::date WHERE id=r.id;
    n:=n+1;
  END LOOP;
  RETURN n;
END $$;

