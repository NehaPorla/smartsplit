# Test cases

`Pass` means the listed automated test passed in the latest recorded Vitest run. Database and browser cases are explicitly marked not run until exercised against services/UI. A source-level implementation is not counted as a runtime pass.

| ID | Description | Input | Expected result | Actual result | Pass/fail |
|---|---|---|---|---|---|
| DB-01 | Reject split total that differs from expense amount | Expense 10.00, split 9.00 | Transaction rejects and rolls back | SQL function and deferred trigger implement rejection; live DB test not run | Not run |
| DB-02 | Reject split participant outside group | Member UUID not in expense group | Database rejects write | Membership triggers implement rejection; live DB test not run | Not run |
| DB-03 | Enforce settlement does not exceed live debt | Settlement above debtor/creditor outstanding amount | Database rejects write | `settle_up`/trigger implement validation; live DB test not run | Not run |
| DB-04 | Reconcile stored and calculated balances | Seeded group expense and settlement rows | `v_balance_reconciliation` has no mismatches | `db:verify` not run in this task | Not run |
| DB-05 | Audit data mutations | Insert/update/delete a tracked row | Trigger appends audit event with operation and row data | Trigger definition exists; live DB test not run | Not run |
| DB-06 | Run recurring expenses due today | Active schedule with `next_run <= CURRENT_DATE` | Procedure creates balanced expense/splits and advances schedule | Function exists; live DB test not run | Not run |
| AUTH-01 | Verify signed user session | Issue token for a member id | Token verifies and returns the bound user id | `auth.test.ts`: signed session test passed | Pass |
| AUTH-02 | Reject tampered/malformed session | Append bytes to signed token; pass malformed text | Verification returns null | `auth.test.ts`: tampered and malformed test passed | Pass |
| AUTH-03 | Reject a member from admin-only operations | Member session user passed to admin guard | 403 `FORBIDDEN` authorization error | `api.test.ts`: guard and JSON error response tests passed; HTTP route integration not run | Pass (unit) |
| AUTH-04 | Enforce owner/admin role for owner-only operations | member, owner and admin role combinations | Owner/admin allowed; ordinary member rejected | `api.test.ts`: group-owner guard test passed; database membership lookup not exercised | Pass (unit) |
| AUTH-05 | Prevent admin self-deactivation/self-demotion | Admin patches own `isActive=false` or role `member` | Conflict response; account remains protected | Guard exists; route-level integration test not present/run | Not run |
| SPLIT-01 | Allocate equal expense with remainder | 1.00 across 3 people | 0.34, 0.33, 0.33 in deterministic order | `expense.test.ts`: remainder test passed | Pass |
| SPLIT-02 | Validate exact allocations | 5.00 and 5.01 for 10.01 | Exact total accepted in paise | `expense.test.ts`: exact allocation test passed | Pass |
| SPLIT-03 | Validate percentage allocations | 50%, 30%, 20% of 100.01 | Allocations total 100.01 with deterministic rounding | `expense.test.ts`: percentage allocation test passed | Pass |
| SPLIT-04 | Allocate weighted shares | Weights 1:2:3 of 1.01 | 0.17, 0.34, 0.50 | `expense.test.ts`: shares test passed | Pass |
| SPLIT-05 | Reject malformed split inputs | Too many decimals, mismatched exact total, percent != 100, zero shares, duplicate participant | Validation throws | `expense.test.ts`: invalid input test passed | Pass |
| ALG-01 | Simplify a balanced four-person ledger | balances -70,-30,+60,+40 paise | Transfers conserve every user's balance | `core.test.ts`: conservation test passed | Pass |
| ALG-02 | Preserve ledger conservation for generated cases | Balanced ledgers from 2 to 19 members | Sum of transfers remains zero | `core.test.ts`: generated-ledger test passed | Pass |
| INV-01 | Create URL-safe invite token | Generate two invite tokens | Valid format, expected length, unique tokens | `invite.test.ts`: token test passed | Pass |
| VEC-01 | Generate deterministic normalized embedding | Same text twice | Equal unit-normalized vectors of length 384 | `embedding.test.ts`: embedding test passed | Pass |
| UI-01 | Register, login, logout and new-user empty state | New user account; visit `/`, `/register`, `/login` | Auto-login, empty groups, zero balances, logout to login | Browser flow not run | Not run |
| UI-02 | Create group and invite a member | Owner creates group and member follows invite | Group membership appears for both users | Browser/API flow not run | Not run |
| UI-03 | Create and inspect expense | Exercise each split mode and detail drawer | Stored expense and every participant's share display | Browser/API flow not run | Not run |
| UI-04 | View balances and make partial settlement | Group with live debt; submit allowed partial amount | Balances refresh, history and graph update | Browser/API flow not run | Not run |
| UI-05 | Admin tools and SQL demo | Admin login; open `/admin` and `/admin/sql-demo` | Admin data/demo renders and actions report results | Browser flow not run | Not run |
