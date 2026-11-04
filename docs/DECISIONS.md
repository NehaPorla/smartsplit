# Decisions

- PostgreSQL stores money, membership and expense records because foreign keys, checks and transactions preserve accounting integrity.
- Neo4j is the optional graph projection for traversing debtor/creditor relationships; settlement calculations remain reproducible in TypeScript and PostgreSQL.
- All calculations use integer paise in TypeScript. PostgreSQL stores display-ready values as `numeric(12,2)`.
- Vector search is configured as optional (`ENABLE_VECTOR=false` by default). pgvector is not assumed installed; the initial schema reserves a separate table for vectors and this starter does not expose semantic search until an embedding provider and pgvector extension are configured.
- Demo dashboard starts with illustrative sample presentation data. Connect authenticated data routes before using it for real accounts.
- Two-member ownership areas are suggested in `TEAM.md`; replace names before submission.
