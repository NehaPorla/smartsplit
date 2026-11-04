-- Safe to rerun: ddl_demo is reserved as a disposable scratch schema.
DROP SCHEMA IF EXISTS ddl_demo CASCADE;
CREATE SCHEMA ddl_demo;
CREATE TABLE ddl_demo.sample_parent(id integer PRIMARY KEY,name varchar(80) NOT NULL UNIQUE);
CREATE TABLE ddl_demo.sample_child(id integer PRIMARY KEY,parent_id integer NOT NULL REFERENCES ddl_demo.sample_parent(id) ON DELETE CASCADE,amount numeric(10,2) NOT NULL CHECK(amount>0));
CREATE INDEX sample_child_parent_idx ON ddl_demo.sample_child(parent_id);
CREATE VIEW ddl_demo.sample_totals AS SELECT parent_id,sum(amount) AS total FROM ddl_demo.sample_child GROUP BY parent_id;
ALTER TABLE ddl_demo.sample_child ADD COLUMN memo varchar(40) NOT NULL DEFAULT '';
ALTER TABLE ddl_demo.sample_child ALTER COLUMN memo TYPE text;
ALTER TABLE ddl_demo.sample_child ADD CONSTRAINT sample_child_memo_length CHECK(length(memo)<500);
DROP VIEW ddl_demo.sample_totals;
DROP INDEX ddl_demo.sample_child_parent_idx;
ALTER TABLE ddl_demo.sample_child DROP CONSTRAINT sample_child_memo_length;
DROP TABLE ddl_demo.sample_child;
DROP TABLE ddl_demo.sample_parent;
DROP SCHEMA ddl_demo;

