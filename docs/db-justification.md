# Database choice

PostgreSQL is the source of truth for users, memberships, expenses, splits and settlements. These records have clear relationships and monetary invariants; ACID transactions, foreign keys, checks, deferred constraints, parameterized SQL and row locks fit that workload. A generated `tsvector` with a GIN index supports title/note search.

Neo4j represents the derived debt network: user nodes and directed `OWES` relationships. Graph traversal is useful for visualizing payment paths and exploring cycles. It is a rebuildable projection, so PostgreSQL remains authoritative when Neo4j is offline.

The configured vector option is reserved for semantic expense retrieval. `ENABLE_VECTOR` defaults off because no local embedding model or pgvector installation is bundled in this starter; do not claim semantic retrieval is active until both are installed and enabled.
