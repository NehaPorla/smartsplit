CREATE OR REPLACE FUNCTION audit_row() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE oldj jsonb; newj jsonb; payload jsonb; rid uuid; actor uuid;
BEGIN
  IF TG_OP<>'INSERT' THEN oldj:=to_jsonb(OLD); END IF;
  IF TG_OP<>'DELETE' THEN newj:=to_jsonb(NEW); END IF;
  payload:=coalesce(newj,oldj);
  rid:=coalesce(nullif(payload->>'id','')::uuid,nullif(payload->>'expense_id','')::uuid,nullif(payload->>'group_id','')::uuid);
  actor:=nullif(current_setting('app.user_id',true),'')::uuid;
  INSERT INTO audit_log(table_name,operation,row_id,old_data,new_data,changed_by)
  VALUES(TG_TABLE_NAME,TG_OP,rid,oldj,newj,actor);
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;

CREATE OR REPLACE FUNCTION validate_expense_member() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM group_members WHERE group_id=NEW.group_id AND user_id=NEW.paid_by) THEN
    RAISE EXCEPTION 'Payer % must be a member of group %',NEW.paid_by,NEW.group_id;
  END IF;
  IF EXISTS(SELECT 1 FROM expense_splits s WHERE s.expense_id=NEW.id AND NOT EXISTS(
      SELECT 1 FROM group_members gm WHERE gm.group_id=NEW.group_id AND gm.user_id=s.user_id)) THEN
    RAISE EXCEPTION 'All existing split participants must belong to the expense group';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS expenses_member_check ON expenses;
CREATE TRIGGER expenses_member_check BEFORE INSERT OR UPDATE OF group_id,paid_by ON expenses FOR EACH ROW EXECUTE FUNCTION validate_expense_member();

CREATE OR REPLACE FUNCTION validate_split_member() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE gid uuid;
BEGIN
  IF TG_OP='UPDATE' AND NEW.expense_id<>OLD.expense_id THEN
    RAISE EXCEPTION 'A split cannot be moved to another expense; delete and recreate it';
  END IF;
  SELECT group_id INTO gid FROM expenses WHERE id=NEW.expense_id;
  IF gid IS NULL OR NOT EXISTS(SELECT 1 FROM group_members WHERE group_id=gid AND user_id=NEW.user_id) THEN
    RAISE EXCEPTION 'Split participant % must belong to the expense group',NEW.user_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS splits_member_check ON expense_splits;
CREATE TRIGGER splits_member_check BEFORE INSERT OR UPDATE ON expense_splits FOR EACH ROW EXECUTE FUNCTION validate_split_member();

CREATE OR REPLACE FUNCTION validate_settlement() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE from_balance numeric; to_balance numeric; available_from numeric; available_to numeric;
BEGIN
  IF TG_OP='UPDATE' AND (NEW.group_id,NEW.from_user,NEW.to_user) IS DISTINCT FROM (OLD.group_id,OLD.from_user,OLD.to_user) THEN
    RAISE EXCEPTION 'Settlement group and participants are immutable; delete and record a new settlement';
  END IF;
  PERFORM 1 FROM groups WHERE id=NEW.group_id FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM group_members WHERE group_id=NEW.group_id AND user_id=NEW.from_user)
     OR NOT EXISTS(SELECT 1 FROM group_members WHERE group_id=NEW.group_id AND user_id=NEW.to_user) THEN
    RAISE EXCEPTION 'Settlement users must both be members of the group';
  END IF;
  SELECT b.balance INTO from_balance FROM get_group_balances(NEW.group_id) b WHERE b.user_id=NEW.from_user;
  SELECT b.balance INTO to_balance FROM get_group_balances(NEW.group_id) b WHERE b.user_id=NEW.to_user;
  IF TG_OP='UPDATE' THEN
    from_balance:=from_balance-OLD.amount;
    to_balance:=to_balance+OLD.amount;
  END IF;
  available_from:=-from_balance; available_to:=to_balance;
  IF from_balance>=0 OR to_balance<=0 OR NEW.amount>least(available_from,available_to) THEN
    RAISE EXCEPTION 'Settlement must not exceed the outstanding debt from a debtor to a creditor';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS settlements_integrity_check ON settlements;
CREATE TRIGGER settlements_integrity_check BEFORE INSERT OR UPDATE ON settlements FOR EACH ROW EXECUTE FUNCTION validate_settlement();

CREATE OR REPLACE FUNCTION prevent_unsettled_group_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM get_group_balances(OLD.id) WHERE balance<>0) THEN
    RAISE EXCEPTION 'Cannot delete group % while balances remain unsettled',OLD.id;
  END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS groups_unsettled_delete_check ON groups;
CREATE TRIGGER groups_unsettled_delete_check BEFORE DELETE ON groups FOR EACH ROW EXECUTE FUNCTION prevent_unsettled_group_delete();

CREATE OR REPLACE FUNCTION prevent_member_leave_with_balance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF (NEW.group_id,NEW.user_id) IS DISTINCT FROM (OLD.group_id,OLD.user_id) THEN
      RAISE EXCEPTION 'Membership identity is immutable; leave and rejoin using application rules';
    END IF;
    RETURN NEW;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM groups WHERE id=OLD.group_id) THEN RETURN OLD; END IF;
  IF EXISTS(SELECT 1 FROM get_group_balances(OLD.group_id) b WHERE b.user_id=OLD.user_id AND b.balance<>0) THEN
    RAISE EXCEPTION 'Cannot remove member % while their group balance is unsettled',OLD.user_id;
  END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS membership_unsettled_delete_check ON group_members;
CREATE TRIGGER membership_unsettled_delete_check BEFORE UPDATE OR DELETE ON group_members FOR EACH ROW EXECUTE FUNCTION prevent_member_leave_with_balance();

CREATE OR REPLACE FUNCTION check_split_total() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE eid uuid; actual numeric; expected numeric;
BEGIN
  IF TG_TABLE_NAME='expenses' THEN
    IF TG_OP='DELETE' THEN eid:=OLD.id; ELSE eid:=NEW.id; END IF;
  ELSE
    IF TG_OP='DELETE' THEN eid:=OLD.expense_id; ELSE eid:=NEW.expense_id; END IF;
  END IF;
  SELECT amount INTO expected FROM expenses WHERE id=eid;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT sum(share_amount) INTO actual FROM expense_splits WHERE expense_id=eid;
  IF actual IS NULL OR actual<>expected THEN RAISE EXCEPTION 'Split total % must equal expense % for %',actual,expected,eid; END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS expenses_total_check ON expenses;
CREATE CONSTRAINT TRIGGER expenses_total_check AFTER INSERT OR UPDATE ON expenses DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_split_total();
DROP TRIGGER IF EXISTS splits_total_check ON expense_splits;
CREATE CONSTRAINT TRIGGER splits_total_check AFTER INSERT OR UPDATE OR DELETE ON expense_splits DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_split_total();

CREATE OR REPLACE FUNCTION refresh_group_balances(p_group uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- Cascading deletes can invoke row triggers after the parent group has already been marked deleted.
  IF NOT EXISTS(SELECT 1 FROM groups WHERE id=p_group) THEN RETURN; END IF;
  DELETE FROM group_balances WHERE group_id=p_group;
  INSERT INTO group_balances(group_id,user_id,balance)
    SELECT p_group,user_id,balance FROM get_group_balances(p_group);
END $$;

CREATE OR REPLACE FUNCTION refresh_balance_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE gid uuid; eid uuid;
BEGIN
  IF TG_TABLE_NAME='expenses' THEN
    IF TG_OP<>'INSERT' THEN PERFORM refresh_group_balances(OLD.group_id); END IF;
    IF TG_OP<>'DELETE' THEN PERFORM refresh_group_balances(NEW.group_id); END IF;
  ELSIF TG_TABLE_NAME='settlements' THEN
    IF TG_OP<>'INSERT' THEN PERFORM refresh_group_balances(OLD.group_id); END IF;
    IF TG_OP<>'DELETE' THEN PERFORM refresh_group_balances(NEW.group_id); END IF;
  ELSIF TG_TABLE_NAME='group_members' THEN
    IF TG_OP<>'INSERT' THEN PERFORM refresh_group_balances(OLD.group_id); END IF;
    IF TG_OP<>'DELETE' THEN PERFORM refresh_group_balances(NEW.group_id); END IF;
  ELSE
    IF TG_OP<>'INSERT' THEN SELECT group_id INTO gid FROM expenses WHERE id=OLD.expense_id; IF gid IS NOT NULL THEN PERFORM refresh_group_balances(gid); END IF; END IF;
    IF TG_OP<>'DELETE' THEN SELECT group_id INTO gid FROM expenses WHERE id=NEW.expense_id; IF gid IS NOT NULL THEN PERFORM refresh_group_balances(gid); END IF; END IF;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS expenses_balance_refresh ON expenses;
CREATE TRIGGER expenses_balance_refresh AFTER INSERT OR UPDATE OR DELETE ON expenses FOR EACH ROW EXECUTE FUNCTION refresh_balance_trigger();
DROP TRIGGER IF EXISTS splits_balance_refresh ON expense_splits;
CREATE TRIGGER splits_balance_refresh AFTER INSERT OR UPDATE OR DELETE ON expense_splits FOR EACH ROW EXECUTE FUNCTION refresh_balance_trigger();
DROP TRIGGER IF EXISTS settlements_balance_refresh ON settlements;
CREATE TRIGGER settlements_balance_refresh AFTER INSERT OR UPDATE OR DELETE ON settlements FOR EACH ROW EXECUTE FUNCTION refresh_balance_trigger();
DROP TRIGGER IF EXISTS memberships_balance_refresh ON group_members;
CREATE TRIGGER memberships_balance_refresh AFTER INSERT OR UPDATE OR DELETE ON group_members FOR EACH ROW EXECUTE FUNCTION refresh_balance_trigger();

DROP TRIGGER IF EXISTS users_audit ON users;
CREATE TRIGGER users_audit AFTER INSERT OR UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION audit_row();
DROP TRIGGER IF EXISTS groups_audit ON groups;
CREATE TRIGGER groups_audit AFTER INSERT OR UPDATE OR DELETE ON groups FOR EACH ROW EXECUTE FUNCTION audit_row();
DROP TRIGGER IF EXISTS memberships_audit ON group_members;
CREATE TRIGGER memberships_audit AFTER INSERT OR UPDATE OR DELETE ON group_members FOR EACH ROW EXECUTE FUNCTION audit_row();
DROP TRIGGER IF EXISTS expenses_audit ON expenses;
CREATE TRIGGER expenses_audit AFTER INSERT OR UPDATE OR DELETE ON expenses FOR EACH ROW EXECUTE FUNCTION audit_row();
DROP TRIGGER IF EXISTS splits_audit ON expense_splits;
CREATE TRIGGER splits_audit AFTER INSERT OR UPDATE OR DELETE ON expense_splits FOR EACH ROW EXECUTE FUNCTION audit_row();
DROP TRIGGER IF EXISTS settlements_audit ON settlements;
CREATE TRIGGER settlements_audit AFTER INSERT OR UPDATE OR DELETE ON settlements FOR EACH ROW EXECUTE FUNCTION audit_row();
DROP TRIGGER IF EXISTS recurring_audit ON recurring_expenses;
CREATE TRIGGER recurring_audit AFTER INSERT OR UPDATE OR DELETE ON recurring_expenses FOR EACH ROW EXECUTE FUNCTION audit_row();
