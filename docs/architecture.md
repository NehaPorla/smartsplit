# Architecture

```mermaid
flowchart LR
 Browser --> Next[Next.js App Router]
 Next --> API[Route handlers]
 API --> PG[(PostgreSQL)]
 API --> Neo[(Neo4j projection)]
 PG --> Views[Views and SQL functions]
```

The intended request path is browser → Next.js route handler → validated, parameterized query → PostgreSQL. A graph sync can project group balances to Neo4j. Keep credentials in environment variables; do not place secrets in client bundles.
