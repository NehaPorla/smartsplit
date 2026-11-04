# Testing results

Run from the repository root on Windows PowerShell, 2026-11-04. No `db:init`, `db:seed` or database mutation was run.

## TypeScript

Command: `npx.cmd tsc --noEmit`

Result: exit code 0; no diagnostics (no stdout/stderr).

## Automated tests

Command: `npm.cmd test`

Captured output:

```text
> smartsplit@1.0.0 test
> vitest run


 RUN  v2.1.9 C:/Users/LAPTOPS24/Downloads/smartsplit

 ✓ tests/api.test.ts (3)
 ✓ tests/auth.test.ts (2)
 ✓ tests/core.test.ts (4)
 ✓ tests/embedding.test.ts (2)
 ✓ tests/expense.test.ts (7)
 ✓ tests/invite.test.ts (2)

 Test Files  6 passed (6)
      Tests  20 passed (20)
   Start at  19:41:56
   Duration  4.03s (transform 2.37s, setup 0ms, collect 4.40s, tests 137ms, environment 3ms, prepare 2.91s)
```

Result: exit code 0; 6 test files and 20 tests passed. Coverage includes pure admin/group-owner guards and JSON errors as well as token signing/verification, money and split allocation, debt simplification, invite tokens and vector formatting. Database-backed route authorization still needs integration testing.

## Production build

Command: `npm.cmd run build`

> smartsplit@1.0.0 build
> next build

  ▲ Next.js 14.2.35
  - Environments: .env.local

   Creating an optimized production build ...
 ✓ Compiled successfully
 ✓ Linting and checking validity of types    
 ✓ Collecting page data    
 ✓ Generating static pages (29/29)
 ✓ Collecting build traces    
 ✓ Finalizing page optimization    

Route (app)                                               Size     First Load JS
┌ ○ /                                                     4.32 kB         100 kB
├ ○ /_not-found                                           873 B          88.1 kB
├ ○ /activity                                             1.51 kB        88.8 kB
├ ○ /admin                                                3.34 kB        99.3 kB
├ ○ /admin/sql-demo                                       1.29 kB        97.3 kB
├ ○ /analytics                                            2.01 kB        89.3 kB
├ ƒ /api/activity                                         0 B                0B
├ ƒ /api/admin/audit                                      0 B                0B
├ ƒ /api/admin/groups                                     0 B                0B
├ ƒ /api/admin/groups/[groupId]                           0 B                0B
├ ƒ /api/admin/neo4j-health                               0 B                0B
├ ƒ /api/admin/recurring/run                              0 B                0B
├ ƒ /api/admin/sql-demo                                   0 B                0B
├ ƒ /api/admin/stats                                      0 B                0B
├ ƒ /api/admin/users                                      0 B                0B
├ ƒ /api/admin/users/[userId]                             0 B                0B
├ ƒ /api/analytics                                        0 B                0B
├ ƒ /api/auth/login                                       0 B                0B
├ ƒ /api/auth/logout                                      0 B                0B
├ ƒ /api/auth/register                                    0 B                0B
├ ƒ /api/categories                                       0 B                0B
├ ƒ /api/groups                                           0 B                0B
├ ƒ /api/groups/[groupId]                                 0 B                0B
├ ƒ /api/groups/[groupId]/balances                        0 B                0B
├ ƒ /api/groups/[groupId]/debts                           0 B                0B
├ ƒ /api/groups/[groupId]/expenses                        0 B                0B
├ ƒ /api/groups/[groupId]/expenses/[expenseId]            0 B                0B
├ ƒ /api/groups/[groupId]/expenses/[expenseId]/embedding  0 B                0B
├ ƒ /api/groups/[groupId]/export                          0 B                0B
├ ƒ /api/groups/[groupId]/invite                          0 B                0B
├ ƒ /api/groups/[groupId]/members                         0 B                0B
├ ƒ /api/groups/[groupId]/members/[userId]                0 B                0B
├ ƒ /api/groups/[groupId]/recurring                       0 B                0B
├ ƒ /api/groups/[groupId]/search                          0 B                0B
├ ƒ /api/groups/[groupId]/settlements                     0 B                0B
├ ƒ /api/groups/[groupId]/similar                         0 B                0B
├ ƒ /api/groups/[groupId]/suggest-category                0 B                0B
├ ƒ /api/health                                           0 B                0B
├ ƒ /api/invites/[token]/accept                           0 B                0B
├ ƒ /api/me                                               0 B                0B
├ ƒ /api/me/password                                      0 B                0B
├ ○ /groups                                               1.81 kB        97.8 kB
├ ƒ /groups/[groupId]                                     6.2 kB          102 kB
├ ƒ /groups/[groupId]/balances                            4.84 kB         101 kB
├ ƒ /groups/[groupId]/expenses/[expenseId]/edit           292 B           101 kB
├ ƒ /groups/[groupId]/expenses/new                        283 B           101 kB
├ ƒ /groups/[groupId]/similar                             1.08 kB        97.1 kB
├ ƒ /invite/[token]                                       971 B            97 kB
├ ○ /login                                                1.07 kB        97.1 kB
├ ○ /profile                                              2.73 kB        98.7 kB
└ ○ /register  

## Not run

- `npm.cmd run db:init` and `npm.cmd run db:seed` were deliberately not run because initialization drops the public schema and seeding rewrites demo rows.
- `npm.cmd run db:verify`, PostgreSQL trigger/procedure integration, browser flows, Neo4j connectivity and pgvector similarity were not run in this task. Follow the README for database setup only when using the intended development database. See `test-cases.md` and `requirements-checklist.md` for case-level status and limits.
