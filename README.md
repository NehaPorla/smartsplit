# SmartSplit

SmartSplit tracks shared group expenses, calculates balances, and suggests a smaller set of payments to settle them. PostgreSQL is the accounting source of truth. Neo4j debt-graph sync and pgvector similarity search are optional integrations.

## Features

- Email/password registration and login with httpOnly cookie sessions.
- Groups, member roles, shareable invite links and group expense exports.
- Equal, exact, percentage and shares-based expense splits with paise-accurate allocation.
- Full-text expense search, filters, pagination and detail views.
- Original and simplified debts, partial settlements, history and debt graph with Neo4j/TypeScript fallback.
- Dashboard, activity, profile, analytics, admin/audit tools and SQL requirements demo.
- Monthly recurring expenses and optional pgvector similar-expense functionality.

## Requirements

- Node.js 20 or later and npm.
- PostgreSQL with `pgcrypto`; pgvector is needed only for vector mode.
- Neo4j is optional. Without it, debt simplification uses the TypeScript fallback.

## Setup in Windows PowerShell

Run from the repository root. These commands use the Windows npm shim explicitly.

```powershell
# Install project dependencies
npm.cmd install

# Create local environment configuration, then edit it in your editor
Copy-Item .env.example .env.local
```

Set these values in `.env.local`:

```dotenv
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/smartsplit
JWT_SECRET=replace-with-a-random-secret-at-least-32-characters-long
ENABLE_VECTOR=false
NEO4J_URI=
NEO4J_USERNAME=
NEO4J_PASSWORD=
```

Create the target database once (for example, using `psql` as a PostgreSQL administrator):

```powershell
psql -U postgres -c "CREATE DATABASE smartsplit;"
```

Initialize, seed and verify:

```powershell
npm.cmd run db:init
npm.cmd run db:seed
npm.cmd run db:verify
```

**Warning:** `db:init` drops and recreates the entire `public` schema in the configured database. It deletes existing application data; use it only for a fresh/demo database or an intentional reset. `db:seed` is repeatable for the deterministic demo rows, but rebuilds seeded groups' expenses and memberships.

Start the app and run checks:

```powershell
npm.cmd run dev
# Open http://localhost:3000

npx.cmd tsc --noEmit
npm.cmd test
npm.cmd run build
```

## Demo logins

The seed script prints these credentials after successful seeding:

- Admin: `admin@smartsplit.local` / `SplitAdmin!2026`
- Member: `member@smartsplit.local` / `SplitMember!2026`
- Neha: `neha@example.com` / `NehaSplit!2026`

Change demo passwords before exposing a seeded instance. Do not commit `.env.local` or use demo accounts for real financial data.

## Database and documentation

The schema, functions, triggers, views, indexes and optional vector schema are in `db/`. `npm.cmd run db:verify` checks the expected seeded dataset and key integrity conditions without resetting it. The admin SQL demo is at `/admin/sql-demo`. See `docs/PROJECT_REPORT.md`, `docs/requirements-checklist.md`, and `docs/SCREENSHOTS_TODO.md` for the report, evidence and remaining limitations. Guest members are not implemented; pgvector is disabled by default.
