# SmartSplit API

All handlers are Next.js Route Handlers under `/api`. JSON successes use `{ "data": ... }`; errors use `{ "error": { "code", "message", "details?" } }`. Request bodies and query parameters are validated with Zod. Authentication uses a signed `HttpOnly`, `SameSite=Lax` session cookie; production cookies are secure. The server reloads the user's current role from PostgreSQL for every request. Group endpoints require group membership, including for administrators. Only `/api/admin/*` uses the platform administrator role.

## Authentication and profile

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Create a member account |
| POST | `/api/auth/login` | Authenticate and set the session cookie |
| POST | `/api/auth/logout` | Clear the session cookie |
| GET, PATCH | `/api/me` | Read or update the current user's profile |

## Groups and expenses

| Method | Path | Purpose |
| --- | --- | --- |
| GET, POST | `/api/groups` | List groups the user belongs to; create a group |
| GET, PATCH, DELETE | `/api/groups/:groupId` | Read, update, or delete a member group |
| GET, POST | `/api/groups/:groupId/members` | List/add members |
| DELETE | `/api/groups/:groupId/members/:userId` | Remove a member |
| GET, POST | `/api/groups/:groupId/expenses` | Filter/search expenses or create an expense |
| GET, PATCH, DELETE | `/api/groups/:groupId/expenses/:expenseId` | Read, edit, or soft-delete an expense |
| GET | `/api/groups/:groupId/search` | Search and filter expenses (same full-text query as the expense list) |
| GET | `/api/groups/:groupId/balances` | Balances and simplified repayment plan |
| GET | `/api/groups/:groupId/debts` | Debt plan alias for balances |
| GET, POST | `/api/groups/:groupId/settlements` | List or record a settlement |
| GET, POST | `/api/groups/:groupId/similar` | Similar expenses; POST accepts `{ "embedding": [384 numbers], "limit": 10 }` |
| PUT | `/api/groups/:groupId/expenses/:expenseId/embedding` | Index a client-provided 384-number vector |
| GET | `/api/analytics` | Spend, monthly trend, and top spenders for the user's groups (admins can query globally) |

Expense creation accepts `splitType` `equal`, `exact`, `percentage`, or `shares` and a `splits` array of `{ userId, amount? , percentage? , shares? }`. Equal splits allocate remaining paise deterministically; exact amounts must sum to the expense total; percentages must total 100%; shares use positive integer weights. An optional 384-number `embedding` is indexed only when `ENABLE_VECTOR=true`.

Expense list filters include `page`, `pageSize`, `categoryId`, `paidBy`, `from`, `to`, and `q`. `q` uses PostgreSQL full-text search. Writes use parameterized SQL and transactions; database triggers maintain balance projections and audit rows.

## Administration

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/admin/users` | Search/list accounts |
| PATCH | `/api/admin/users/:userId` | Change a user's name or role (last-admin guard) |
| GET | `/api/admin/groups` | List all groups |
| DELETE | `/api/admin/groups/:groupId` | Delete a group |
| GET | `/api/admin/audit` | Browse audit events |
| GET | `/api/admin/stats` | Platform counts, spend, activity, and top groups |
| GET | `/api/admin/neo4j-health` | Neo4j availability |

## Graph and vector behavior

Balance reads attempt to sync the group's membership and simplified debt edges to Neo4j. When Neo4j is unavailable, the TypeScript debt simplifier returns the plan from PostgreSQL balances. Set `ENABLE_VECTOR=true` only after installing the pgvector extension on the database server; `npm run db:init` then applies `db/vector.sql`. The API accepts externally generated 384-dimensional vectors; it does not create embeddings itself. With the flag disabled, similar-expense endpoints return an explicit disabled response.

## Demo credentials

The repeatable demo seed prints the credentials when it completes:

- Admin: `admin@smartsplit.local` / `SplitAdmin!2026`
- Member: `member@smartsplit.local` / `SplitMember!2026`
- Neha: `neha@example.com` / `NehaSplit!2026` (member of Goa Getaway and Weekend Crew)

Change demo passwords before using the instance beyond local demonstration.
