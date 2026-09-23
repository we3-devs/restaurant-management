# Restaurant Management System

A NestJS 11 REST API (`backend/`, plus `backend-superadmin/`) and three Next.js App Router
frontends under `apps/` (`guest-web`, `staff-web`, `superadmin-web`) with shared workspace
packages under `packages/`.

The Postgres schema originated as a migration from a Laravel/Inertia app, which is no longer
part of this project. It is now captured in full by `1782300000000-BaselineSchema.ts` (125 tables,
loaded from an adjacent `sql/` dump), which squashed 131 incremental migrations -- those are kept
for history under `_archive/` and are not runnable on their own, since they assumed the inherited
base schema the baseline replaces.

**Migrations live in `/typeorm/` at the repo root, and that folder is gitignored.** It is not in
version control, so a fresh clone has no schema and `migration:run` will find nothing -- obtain
the folder out of band before provisioning a database. Because it sits outside the backend
package it cannot resolve the `typeorm` package, so migrations there must avoid importing it;
the baseline declares a structural `QueryRunnerLike` instead.

The app always runs with `synchronize: false`, and the entities do NOT match the schema: running
`migration:generate` against a correct database produces thousands of statements, including
`DROP COLUMN tenant_id` on 68 tables. Never apply generated output wholesale -- hand-write schema
changes as migrations instead.

Migrations need a session-mode connection. The Supabase pooler port in `.env` (6543) is
transaction mode, which `pg_dump` and some DDL cannot use -- run migration commands against port
5432.

## Prerequisites

- Access to a Postgres database with the schema already present; connection details in `backend/.env`.
- Redis running locally (`docker compose up -d redis` from the repo root, or your own Redis on `6379`).
- Node.js 20+.

## Backend

```sh
cd backend
npm install
npm run migration:run   # applies pending TypeORM-owned migrations
npm run seed             # idempotent: seeds permissions + super-admin position mapping
npm run start:dev
```

- API: http://localhost:3001/api
- Swagger: http://localhost:3001/docs
- Health check: http://localhost:3001/api/health

There is no bootstrap-admin seeder: nothing in `src/` reads `SEED_ADMIN_EMAIL`/
`SEED_ADMIN_PASSWORD` (those `.env` entries are vestigial), and `run-seed.ts` creates
permissions only -- never a user. A usable login has to come from existing rows.

## Frontend

```sh
cd frontend
npm install
npm run dev
```

- App: http://localhost:3000

## Folder convention for future domains

Each business domain gets its own NestJS module under
`backend/src/modules/<domain>/{<domain>.module.ts, .controller.ts, .service.ts, entities/, dto/}`,
following the `auth`/`roles` modules as the reference pattern. .
