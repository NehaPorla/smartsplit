# Screenshots to capture

Capture from the running app with seeded demo data. Use an admin account for the admin routes and a member account for member-only states. Blur/remove email addresses if the images will be public. Do not capture passwords, `.env.local`, session cookies or secrets.

| # | Exact page | State to capture |
|---:|---|---|
| 1 | `/login` | Login form and a validation/credential error state (separate images if useful). |
| 2 | `/register` | Registration form with field validation visible. |
| 3 | `/` | Logged-in overview with balance cards, groups, recent activity and monthly spending. |
| 4 | `/` | New account empty state with zero balances and “Create your first group”. |
| 5 | `/groups` | Group list, search and New group dialog. |
| 6 | `/groups/<group-id>` | Group Expenses tab with filters/search and expense table. |
| 7 | `/groups/<group-id>` | Members tab with roles, member balances and owner add/remove controls. |
| 8 | `/groups/<group-id>/expenses/new` | Split form with a live preview; capture equal and one non-equal mode. |
| 9 | `/groups/<group-id>/balances` | Original/simplified debts, savings banner, graph toggle, source badge and settlement history. |
| 10 | `/groups/<group-id>/balances` | Settle up modal with a partial payment prefilled. |
| 11 | `/groups/<group-id>/similar` | Vector-disabled notice; if enabled deployment is available, separately capture results. |
| 12 | `/analytics` | Group selector, category/month charts, spender chart and month comparison. |
| 13 | `/activity` | Activity feed with group/type filters and pagination. |
| 14 | `/profile` | Profile, role and account totals. |
| 15 | `/admin` | Admin users/groups/audit/platform stats tabs and visible “SQL requirements demo” entry. |
| 16 | `/admin/sql-demo` | Query examples and trigger/transaction/index demonstrations. |
