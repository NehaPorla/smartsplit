# Two-minute demo

1. Show the dashboard’s “you owe / owed / net” summary and group cards.
2. Explain integer-paise splitting and deterministic leftover distribution; run `npm test`.
3. In PostgreSQL, call `add_expense_with_splits`; demonstrate that an invalid payer or split total causes a rollback.
4. Query `v_group_balances`, then compare the greedy plan from `simplify` with Neo4j `OWES` edges when Neo4j is configured.
5. Search expense titles/notes with `search_doc @@ plainto_tsquery('english', ...)`; point out the GIN index and show the advanced CTE/window examples.
