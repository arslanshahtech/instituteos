# InstituteOS

InstituteOS is a multi-tenant education operations platform for schools, colleges, academies, and multi-campus organizations. The repository has completed Phases 00 and 01: it contains the application and backend foundations, but no business modules yet.

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
