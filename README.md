# Restaurant Management System

A NestJS 11 REST API (`backend/`) + Next.js 16 App Router frontend (`frontend/`), rebuilding the
Laravel/Inertia app in `rms-main/` as two separate apps. This foundation phase covers shared
infra and one working auth flow end to end; business domains (menu, orders, inventory,
purchasing, reservations, POS, loyalty, ...) come in later phases.

The Postgres database (`restaurant`) already has the full ~83-table schema migrated from the
Laravel app. The backend maps onto it as-is (`synchronize: false`); the only table it owns is
`refresh_tokens`.

## Prerequisites

- Postgres running locally with the `restaurant` database already migrated (see `backend/.env`).
- Redis running locally (`docker compose up -d redis` from the repo root, or your own Redis on `6379`).
- Node.js 20+.

## Backend

```sh
cd backend
npm install
npm run migration:run   # creates the refresh_tokens table only
npm run seed             # idempotent: seeds a super-admin role/user
npm run start:dev
```

- API: http://localhost:3001/api
- Swagger: http://localhost:3001/docs
- Health check: http://localhost:3001/api/health

Seeded login (see `backend/.env` `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`):
`admin@rms.local` / `Admin@12345`.

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
following the `auth`/`roles` modules as the reference pattern.
