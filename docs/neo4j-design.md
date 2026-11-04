# Neo4j debt projection

Use `(:User {id,name})-[:OWES {amount,groupId}]->(:User)` to represent minimized obligations. `src/lib/sync.ts` loads PostgreSQL balances, computes the greedy settlement plan, then replaces the group's edges in one Neo4j write transaction. PostgreSQL remains the source of truth; absent Neo4j credentials return an unavailable status so the TypeScript result can still be used.
