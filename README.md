# Restaurant Management System

A NestJS 11 REST API (`backend/`, plus `backend-superadmin/`) and three Next.js App Router
frontends under `apps/` (`guest-web`, `staff-web`, `superadmin-web`) with shared workspace
packages under `packages/`.

The Postgres schema originated as a migration from a Laravel/Inertia app, which is no longer
part of this project. The incremental migrations in `backend/src/database/migrations/` build on
that inherited base schema rather than creating it, so a brand-new empty database cannot yet be
built from this repo alone -- it has to be cloned from an existing one. The app always runs with
`synchronize: false`; schema changes go through a migration, never through entity sync.

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
