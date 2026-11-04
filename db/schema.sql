CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin','member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 100),
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash text NOT NULL,
  role user_role NOT NULL DEFAULT 'member',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
  description text NOT NULL DEFAULT '',
  currency char(3) NOT NULL DEFAULT 'INR' CHECK (currency ~ '^[A-Z]{3}$'),
  icon text NOT NULL DEFAULT '◉' CHECK (length(icon) BETWEEN 1 AND 16),
  invite_token_hash text UNIQUE,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE group_members (
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_role text NOT NULL DEFAULT 'member' CHECK (member_role IN ('owner','member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id,user_id)
);
CREATE TABLE categories (
  id smallserial PRIMARY KEY,
  name text NOT NULL UNIQUE CHECK(length(trim(name)) BETWEEN 1 AND 50)
);
CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  paid_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
  amount numeric(12,2) NOT NULL CHECK(amount > 0),
  category_id smallint REFERENCES categories(id) ON DELETE SET NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  split_type text NOT NULL CHECK(split_type IN ('equal','exact','percentage','shares')),
  notes text NOT NULL DEFAULT '',
  search_doc tsvector GENERATED ALWAYS AS (to_tsvector('english',coalesce(title,'') || ' ' || coalesce(notes,''))) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false
);
CREATE TABLE expense_splits (
  expense_id uuid NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  share_amount numeric(12,2) NOT NULL CHECK(share_amount >= 0),
  PRIMARY KEY(expense_id,user_id)
);
CREATE TABLE settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  from_user uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  to_user uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK(amount > 0),
  settled_at timestamptz NOT NULL DEFAULT now(),
  note text NOT NULL DEFAULT '',
  CHECK(from_user <> to_user)
);
CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  table_name text NOT NULL,
  operation text NOT NULL CHECK(operation IN ('INSERT','UPDATE','DELETE')),
  row_id uuid,
  old_data jsonb,
  new_data jsonb,
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE group_balances (
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance numeric(12,2) NOT NULL DEFAULT 0,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(group_id,user_id)
);
CREATE TABLE recurring_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  paid_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK(amount > 0),
  category_id smallint REFERENCES categories(id) ON DELETE SET NULL,
  day_of_month smallint NOT NULL CHECK(day_of_month BETWEEN 1 AND 28),
  active boolean NOT NULL DEFAULT true,
  next_run date NOT NULL
);
-- Optional vector storage. Semantic retrieval needs a pgvector deployment and is not enabled by this schema.
CREATE TABLE expense_vectors (
  expense_id uuid PRIMARY KEY REFERENCES expenses(id) ON DELETE CASCADE,
  embedding real[] NOT NULL,
  model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);


