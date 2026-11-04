-- Foreign-key lookup and common group activity paths.
CREATE INDEX IF NOT EXISTS group_members_user_idx ON group_members(user_id,group_id);
CREATE INDEX IF NOT EXISTS expenses_group_date_idx ON expenses(group_id,expense_date DESC) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS expenses_payer_date_idx ON expenses(paid_by,expense_date DESC) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS expenses_category_date_idx ON expenses(category_id,expense_date DESC) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS expenses_search_idx ON expenses USING GIN(search_doc) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS splits_user_idx ON expense_splits(user_id,expense_id);
CREATE INDEX IF NOT EXISTS settlements_group_date_idx ON settlements(group_id,settled_at DESC);
CREATE INDEX IF NOT EXISTS settlements_from_user_idx ON settlements(from_user,group_id);
CREATE INDEX IF NOT EXISTS settlements_to_user_idx ON settlements(to_user,group_id);
CREATE INDEX IF NOT EXISTS audit_log_changed_at_idx ON audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_table_row_idx ON audit_log(table_name,row_id,changed_at DESC);
CREATE INDEX IF NOT EXISTS recurring_due_idx ON recurring_expenses(next_run) WHERE active;
