# InstituteOS

InstituteOS is a multi-tenant education operations platform for schools, colleges, academies, and multi-campus organizations. The repository has application, backend, frontend, authentication, and foundational tenant-authorization layers. Education business modules have not been implemented yet.

## Project structure

```text
apps/
  api/       Express REST API (TypeScript)
  web/       React + Vite frontend (TypeScript)
docs/        Architecture, decisions, and product contract
prompts/     Numbered phase prompts
```

The frontend and API are separate deployable applications in one repository and one modular-monolith product. The API is versioned under `/api/v1`.

## Requirements

- Node.js 20.19 or newer
- npm 10 or newer

## Local setup

1. Copy `.env.example` to `.env` in the repository root.
2. Install workspace dependencies with `npm install`.
3. Start both applications with `npm run dev`.
4. Open the frontend at `http://127.0.0.1:5173` and check the API at `http://127.0.0.1:4000/api/v1/health`.

The API connects to MongoDB using `MONGODB_URI`. It starts serving liveness and API routes if MongoDB is unavailable, reports `503` from `/api/v1/ready` until connected, and retries the connection. Run MongoDB locally or set a reachable URI in `.env`. The frontend development server proxies `/api` requests to the local API. Environment variable names and defaults are documented in `.env.example`.

Authentication routes live under `/api/v1/auth`. Local registration creates an active account by default; sign in separately after registration. Registration messaging is generic to avoid disclosing whether an email is already registered. To require email verification or deliver password-reset email, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`, and set `AUTH_WEB_APP_URL` to the frontend URL recipients can reach. SMTP delivery is enabled only when `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` are configured; `SMTP_PORT` defaults to `587`. Production requires email verification and Secure session cookies by default. The session cookie is HttpOnly; use the frontend API client for CSRF-protected sign-out and account changes. Keep provider credentials in local secret-managed environment configuration, never in `.env.example`.

Organization context is resolved from the authenticated user's active membership at `GET /api/v1/organizations/:organizationId/context`. The requested organization ID is checked on the server; it does not itself grant access. Role permissions and platform grants are separate, and frontend permission checks are presentation only. This phase adds the authorization foundation, not organization management or education business modules.

## Quality commands

Run from the repository root:

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
```

See [docs/architecture.md](docs/architecture.md), [docs/decisions.md](docs/decisions.md), and [docs/INSTITUTEOS_CONTRACT.md](docs/INSTITUTEOS_CONTRACT.md) for the foundation and product boundaries.
