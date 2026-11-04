# Data dictionary

Types and defaults below match `../db/schema.sql`. PostgreSQL primary keys are not null. Other columns are `NOT NULL` only where stated; undeclared defaults are absent. Constraints include declared checks, unique keys and foreign keys. The database also enforces normal type, nullability and primary-key rules.

| Table | Column | Type | Null/default | Constraints |
|---|---|---|---|---|
| `users` | `id` | uuid | NOT NULL / `gen_random_uuid()` | PK |
| `users` | `name` | text | NOT NULL | CHECK trimmed length 2–100 |
| `users` | `email` | text | NOT NULL | UNIQUE; CHECK lowercase |
| `users` | `password_hash` | text | NOT NULL | — |
| `users` | `role` | `user_role` | NOT NULL / `member` | enum `admin`, `member` |
| `users` | `is_active` | boolean | NOT NULL / `true` | — |
| `users` | `created_at` | timestamptz | NOT NULL / `now()` | — |
| `groups` | `id` | uuid | NOT NULL / `gen_random_uuid()` | PK |
| `groups` | `name` | text | NOT NULL | CHECK trimmed length 2–120 |
| `groups` | `description` | text | NOT NULL / `''` | — |
| `groups` | `currency` | char(3) | NOT NULL / `INR` | CHECK uppercase three letters |
| `groups` | `icon` | text | NOT NULL / `◉` | CHECK length 1–16 |
| `groups` | `invite_token_hash` | text | NULL | UNIQUE |
| `groups` | `created_by` | uuid | NOT NULL | FK `users(id)`, ON DELETE RESTRICT |
| `groups` | `created_at` | timestamptz | NOT NULL / `now()` | — |
| `group_members` | `group_id` | uuid | NOT NULL | FK `groups(id)`, ON DELETE CASCADE; composite PK |
| `group_members` | `user_id` | uuid | NOT NULL | FK `users(id)`, ON DELETE CASCADE; composite PK |
| `group_members` | `member_role` | text | NOT NULL / `member` | CHECK `owner` or `member` |
| `group_members` | `joined_at` | timestamptz | NOT NULL / `now()` | — |
| `categories` | `id` | smallserial | NOT NULL / sequence | PK |
| `categories` | `name` | text | NOT NULL | UNIQUE; CHECK trimmed length 1–50 |
| `expenses` | `id` | uuid | NOT NULL / `gen_random_uuid()` | PK |
| `expenses` | `group_id` | uuid | NOT NULL | FK `groups(id)`, ON DELETE CASCADE |
| `expenses` | `paid_by` | uuid | NOT NULL | FK `users(id)`, ON DELETE RESTRICT; trigger requires group membership |
| `expenses` | `title` | text | NOT NULL | CHECK trimmed length 1–200 |
| `expenses` | `amount` | numeric(12,2) | NOT NULL | CHECK > 0 |
| `expenses` | `category_id` | smallint | NULL | FK `categories(id)`, ON DELETE SET NULL |
| `expenses` | `expense_date` | date | NOT NULL / `CURRENT_DATE` | — |
| `expenses` | `split_type` | text | NOT NULL | CHECK `equal`, `exact`, `percentage` or `shares` |
| `expenses` | `notes` | text | NOT NULL / `''` | — |
| `expenses` | `search_doc` | tsvector | generated stored | Generated from English title and notes |
| `expenses` | `created_at` | timestamptz | NOT NULL / `now()` | — |
| `expenses` | `is_deleted` | boolean | NOT NULL / `false` | Soft-delete flag |
| `expense_splits` | `expense_id` | uuid | NOT NULL | FK `expenses(id)`, ON DELETE CASCADE; composite PK |
| `expense_splits` | `user_id` | uuid | NOT NULL | FK `users(id)`, ON DELETE RESTRICT; composite PK; trigger requires group membership |
| `expense_splits` | `share_amount` | numeric(12,2) | NOT NULL | CHECK >= 0; deferred trigger requires split sum equal expense amount |
| `settlements` | `id` | uuid | NOT NULL / `gen_random_uuid()` | PK |
| `settlements` | `group_id` | uuid | NOT NULL | FK `groups(id)`, ON DELETE CASCADE |
| `settlements` | `from_user` | uuid | NOT NULL | FK `users(id)`, ON DELETE RESTRICT |
| `settlements` | `to_user` | uuid | NOT NULL | FK `users(id)`, ON DELETE RESTRICT; CHECK differs from `from_user` |
| `settlements` | `amount` | numeric(12,2) | NOT NULL | CHECK > 0; trigger enforces debtor, creditor, membership and outstanding limit |
| `settlements` | `settled_at` | timestamptz | NOT NULL / `now()` | — |
| `settlements` | `note` | text | NOT NULL / `''` | — |
| `audit_log` | `id` | bigserial | NOT NULL / sequence | PK |
| `audit_log` | `table_name` | text | NOT NULL | — |
| `audit_log` | `operation` | text | NOT NULL | CHECK `INSERT`, `UPDATE` or `DELETE` |
| `audit_log` | `row_id` | uuid | NULL | — |
| `audit_log` | `old_data` | jsonb | NULL | — |
| `audit_log` | `new_data` | jsonb | NULL | — |
| `audit_log` | `changed_by` | uuid | NULL | FK `users(id)`, ON DELETE SET NULL |
| `audit_log` | `changed_at` | timestamptz | NOT NULL / `now()` | — |
| `group_balances` | `group_id` | uuid | NOT NULL | FK `groups(id)`, ON DELETE CASCADE; composite PK |
| `group_balances` | `user_id` | uuid | NOT NULL | FK `users(id)`, ON DELETE CASCADE; composite PK |
| `group_balances` | `balance` | numeric(12,2) | NOT NULL / `0` | Updated by triggers |
| `group_balances` | `refreshed_at` | timestamptz | NOT NULL / `now()` | — |
| `recurring_expenses` | `id` | uuid | NOT NULL / `gen_random_uuid()` | PK |
| `recurring_expenses` | `group_id` | uuid | NOT NULL | FK `groups(id)`, ON DELETE CASCADE |
| `recurring_expenses` | `paid_by` | uuid | NOT NULL | FK `users(id)`, ON DELETE RESTRICT |
| `recurring_expenses` | `title` | text | NOT NULL | — |
| `recurring_expenses` | `amount` | numeric(12,2) | NOT NULL | CHECK > 0 |
| `recurring_expenses` | `category_id` | smallint | NULL | FK `categories(id)`, ON DELETE SET NULL |
| `recurring_expenses` | `day_of_month` | smallint | NOT NULL | CHECK 1–28 |
| `recurring_expenses` | `active` | boolean | NOT NULL / `true` | — |
| `recurring_expenses` | `next_run` | date | NOT NULL | — |
| `expense_vectors` | `expense_id` | uuid | NOT NULL | PK; FK `expenses(id)`, ON DELETE CASCADE |
| `expense_vectors` | `embedding` | real[] (default) / vector(384) (optional mode) | NOT NULL | pgvector HNSW cosine index exists only in vector mode |
| `expense_vectors` | `model` | text | NOT NULL | — |
| `expense_vectors` | `created_at` | timestamptz | NOT NULL / `now()` | — |

The schema declares the `user_role` enum. It declares no explicit SQL `CHECK` for `expense_vectors.embedding` dimensions in the default real-array schema. The report's vector dimension applies to `db/vector.sql` mode.

## Views

Views are not base tables and therefore have no separately stored column constraints: `v_group_balances`, `v_user_net_balance`, `v_expense_details`, `v_monthly_category_spend`, `v_balance_reconciliation` and `v_group_spend_ranking` are defined in `../db/views.sql`.
