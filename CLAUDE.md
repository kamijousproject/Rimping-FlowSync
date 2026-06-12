# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> ⚠️ **Next.js 16 + React 19.** This is a newer Next.js than your training data. APIs, conventions, and file layout differ (see below for the ones that bite). When unsure, read `node_modules/next/dist/docs/`.

## Project

FlowSync is a back-office **credit-sales management system** for Rimping — issuing and tracking Purchase Orders (PO) sold on credit, invoicing, partial payments, customer credit limits, LINE notifications, and a JDA/ERP sync via an external RPA bot. The UI, messages, and most docs are in **Thai**; keep user-facing strings Thai.

## Commands

```bash
npm run dev          # dev server → http://localhost:3000
npm run build        # production build
npm start            # serve production build
npm run lint         # eslint (eslint-config-next)
```

There is **no configured test runner** (Playwright is installed but there is no `test` script and no test suite). Don't assume `npm test` exists.

Database / data setup:
```bash
sudo /opt/lampp/bin/mysql -uroot < src/backend/schema.sql   # create schema (XAMPP MySQL 8)
node src/backend/seed-mock-runner.js                        # seed mock data (all PO statuses)
```
One-off SQL migrations live in `migrations/` and `src/backend/migrations/` and are applied manually (not by a migration framework).

External RPA/JDA bot (separate FastAPI service, only needed for JDA sync features):
```bash
cd backend && uvicorn rpa_mock:app --port 8001 --reload     # mock JDA bot on :8001
```

Default logins: `admin` / `Admin@123` (everything except add/edit customers), `superadmin` / `SuperAdmin@123` (full).

## Architecture

**Strict frontend ↔ backend separation, with HTTP as the only boundary.** This is deliberate so AI/external services can be attached later — preserve it.

- `src/app/` — frontend (App Router pages) **and** the REST API (`src/app/api/.../route.ts`). Route groups: `(app)/` = authenticated pages with sidebar/bottom-nav; `login/`, `register/`, `credit-approval/[token]/` = public.
- `src/backend/` — **private** server-only code. Must only ever be imported by API route handlers (via the `@/backend/*` alias), never by client components.
- `src/components/`, `src/lib/` — shared UI and helpers (e.g. `lib/bahtText.ts`).
- `backend/` (repo root, **not** `src/backend`) — standalone Python FastAPI RPA bot + `rpa_mock.py`. Unrelated to the TS backend; communicated with only over HTTP.

### Data & DB
- All DB access goes through `src/backend/db.ts`: `getPool()`, `query()`, `exec()`, and `withTx()` for transactions. The mysql2 pool is cached on `global.__flowsyncPool` (survives HMR). `decimalNumbers: true` — money columns come back as JS numbers, not strings.
- Domain logic lives in `src/backend/services/*.ts` (one per domain: `po`, `payments`, `customers`, `invoices`/`quotations`, `credit-notes`, `billing-notes`, `dashboard`, `inventory`, `products`, `notifications`, `email`). Route handlers should be thin and call services.
- Multi-step money operations (e.g. recording a payment and recomputing `paid_amount`/`remaining_amount`) must happen inside a single `withTx()`.

### Auth & middleware
- JWT in an httpOnly cookie named `fs_session` (`jose` HS256, signed with `JWT_SECRET`). Password hashing via `bcryptjs`. Helpers in `src/backend/auth.ts` (`getCurrentUser`, `findUserByLogin`, `isSuperAdmin`, ...).
- **Next 16 renamed middleware → `proxy`.** The edge auth guard is `src/proxy.ts` (exports `proxy()` + `config.matcher`), not `middleware.ts`. It redirects unauthenticated page requests to `/login`; API auth is enforced per-route.
- In route handlers, gate every endpoint with the helpers in `src/app/api/_helpers.ts`: `requireUser()` and `requireRole("super_admin", ...)`, plus `badRequest()` / `serverError()` for consistent JSON errors. Two roles only: `admin` and `super_admin` (only super_admin may create/edit customers and edit credit). Temporary role grants exist (`temp_role_grants` table).

### Next.js 16 gotchas seen in this codebase
- Dynamic route `params` is a **Promise**: `async function POST(req, ctx: { params: Promise<{ id: string }> })` then `const { id } = await ctx.params`.
- `next.config.ts` uses `experimental.proxyClientMaxBodySize` (large uploads) and a rewrite `/manual → /manual.html`.
- Path alias: `@/*` → `src/*`.

### Domain rules (don't break these)
- **Credit limit is checked server-side before a PO is created** — never trust the client.
- PO lifecycle: `draft → confirmed → packed → checked → delivered → received`, then Invoice + payment status `unpaid → partial → paid`. Moving to `delivered` sets `due_date = today + credit_term_days`. `cancelled` is allowed at any step before `received`, then locked.
- A PO can be edited (PUT `/api/po/[id]`) only while not fully paid; every edit writes an audit log.

### JDA / RPA integration
- `POST /api/po/[id]/jda-trigger` (and the payment equivalent) POSTs to the external RPA bot at `RPA_BOT_URL` (default `http://localhost:8001`) `/rpa/trigger` with `{function_id, data}`, stores the returned `job_id` in `purchase_orders.jda_job_id`, and the UI polls `/api/po/[id]/jda-status`. The bot is async (mock simulates a 5-minute delay) and returns a `jda_po_number` on success. Guard rails: PO must be `confirmed` and not already synced.

## Notifications & cron
- LINE Bot notifications (`@line/bot-sdk`) via `src/backend/services/notifications.ts` for overdue customers, new customers, and credit-limit changes. Configured by `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_ADMIN_USER_ID`.
- Overdue check: `GET /api/cron/check-overdue` (secured by `CRON_SECRET`), driven by `scripts/check-overdue.sh` on crontab. Product sync: `src/backend/sync_products.py` (daily).

## Environment (`.env.local`)
`DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME`, `JWT_SECRET`, `UPLOAD_DIR`, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_ADMIN_USER_ID`, `CRON_SECRET`, `RPA_BOT_URL`, `NEXT_PUBLIC_BASE_URL`. Uploaded files (payment slips, signed docs) are stored under the upload dir and served through `/api/files/[category]/[name]` (gitignored).
