# Indexing

`db/indexes.sql` creates indexes for member lookup by user, active expense timelines by group/date, payer and category timelines, expense full-text search, split participant lookup, settlement history and participants, audit chronology, and due recurring expenses. The text index is a partial GIN index over the generated `expenses.search_doc` tsvector, matching the active-expense full-text queries.

The last statement in `db/advanced_queries.sql` is the reproducible `EXPLAIN (ANALYZE, BUFFERS)` timeline query. Run it after `npm run db:seed`. To compare plans for the composite index, run `DROP INDEX expenses_group_date_idx;` then the EXPLAIN query, and restore it with `CREATE INDEX expenses_group_date_idx ON expenses(group_id,expense_date DESC) WHERE NOT is_deleted;`. Reapply `db/indexes.sql` afterward. Do not record fixed timings: the plan and execution time depend on local PostgreSQL statistics, hardware and row count.
