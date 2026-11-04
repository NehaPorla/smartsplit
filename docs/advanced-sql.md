# Advanced SQL demonstrations

The database layer implements more than four advanced concepts and includes executable demonstrations in `../db/`.

- **Transactional writes and row locks:** `add_expense_with_splits` and `settle_up` lock the group row and write their related records within the caller's transaction.
- **Triggers:** validate payer/split/settlement membership, prevent group or member deletion with unsettled balances, enforce split totals at commit, maintain `group_balances`, and audit row changes.
- **Functions:** `get_group_balances`, `add_expense_with_splits`, `settle_up`, `simplify_debts_preview`, and `run_recurring_expenses`.
- **Views:** computed group and user balances, expense details, monthly category totals, trigger/calculation reconciliation, and spender ranking.
- **Indexes:** foreign-key access paths, partial timeline indexes, and a GIN full-text index over generated `tsvector`.
- **Query features:** `advanced_queries.sql` demonstrates inner/left/self joins, all listed aggregates, grouping/HAVING/order, correlated and uncorrelated subqueries, CTEs, window functions, recursion, full-text ranking, and `EXPLAIN ANALYZE`.
- **DDL/DML demonstrations:** `ddl_demo.sql` uses a disposable schema and covers CREATE, ALTER, DROP and constraints. `dml_demo.sql` uses seeded app data inside a transaction and rolls its writes back.

`search_doc` is generated from each expense title and note using PostgreSQL's English text search configuration; the GIN index makes `plainto_tsquery`/`@@` searches indexable. To capture performance evidence, run the final EXPLAIN query in `advanced_queries.sql` after seeding. Planner choices and timings depend on PostgreSQL version, statistics and hardware, so no fabricated timing is recorded here.

The vector table is only a storage placeholder: pgvector similarity search is not implemented by this SQL layer.
