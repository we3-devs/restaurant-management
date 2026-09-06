# Superadmin backend

This is the dedicated superadmin API deployment. It is intentionally not a
`/api/superadmin` route on the normal API. This backend has its own `src/`,
`package.json`, lockfile, configuration, migrations, and build output.

The process is locked to `API_MODE=superadmin` in its own `src/main.ts`:

- `backend/` runs the normal restaurant API on port `3001`.
- `backend-superadmin/` runs the superadmin API on port `3002`.
- The superadmin API accepts authenticated users only when `users.is_superadmin`
  is `true`.
- Ordinary admins, managers, and staff receive `403` responses.
- The normal API rejects superadmin sessions.

Run from this directory independently:

```text
npm install
npm run start:dev
```

Production must provide a separate JWT secret and should use a separate
database credential with only the required platform privileges.
