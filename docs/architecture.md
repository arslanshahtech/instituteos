# Architecture

## Current foundation

InstituteOS is a modular monolith. The repository has a React/Vite browser application in `apps/web` and a Node.js/Express REST API in `apps/api`. They are separate application entry points in one product repository; the API is not split into microservices.

The API uses TypeScript with ES modules. Its intended request flow is:

```text
HTTP request -> request ID / logging / security / CORS / rate limit
  -> /api/v1 route -> controller -> service -> repository -> model -> MongoDB
```

The system foundation implements operational endpoints only: `GET /api/v1` is the version marker, `GET /api/v1/health` is a liveness check, and `GET /api/v1/ready` reports readiness including MongoDB state. Unknown paths receive structured errors through centralized error handling. System routes use a route/controller/service module; domain repositories and models are added with later business modules.

The HTTP listener starts independently of MongoDB. An initial database failure is logged without exposing the connection URI, readiness remains unavailable, and connection attempts retry. Once connected, Mongoose manages connection recovery. Shutdown closes the HTTP listener and database connection, with a bounded timeout.

Cross-cutting middleware assigns a validated or generated request ID, logs route templates and response metadata without query strings or headers, sets Helmet security headers, applies an origin allowlist, parses bounded JSON bodies, and rate-limits API requests. Health and readiness probes are excluded from rate limiting. The default rate-limit store is process-local; deployments with multiple API instances should configure a shared store.

The frontend is a React application served by Vite, with React Router role-layout previews, TanStack Query providers, a centralized typed API client, and reusable UI primitives for forms, tables, paging, dialogs, notifications, and common page states. React Hook Form and Zod provide the form validation foundation. The role selector is explicitly a layout preview; it is not an authorization control. During local development, `/api` requests are proxied to the API process.

## Module boundaries

As business capabilities are added, keep their code inside feature modules and route requests through middleware, controllers, services, repositories/data access, and models where the behavior warrants those layers. Organization-owned records must be scoped and authorization enforced on the server. Shared code should remain small and cross-cutting.

MongoDB through Mongoose is the configured data store. Domain repositories and models belong to their feature phases. SaaS subscription billing and institute fee collection remain separate domains.

## Configuration and quality

Copy the root `.env.example` to `.env` for local configuration. The API validates numeric settings and loads the root environment file. Set `MONGODB_URI` through secret management outside local development. Set `API_TRUST_PROXY_HOPS` to the exact number of trusted reverse-proxy hops when deployed behind a proxy; leave it at `0` otherwise. The frontend reads Vite-prefixed variables from the root environment file. Never place real secrets in `.env.example` or source control.

The root npm workspace provides shared linting and formatting. Each application provides build, test, and typecheck scripts; root scripts run those across applicable workspaces.

## Deferred capabilities

Authentication, tenant resolution, authorization, domain persistence, audit logging, and business features are not implemented in this foundation. They must be designed and added in their assigned phases before the API is used for real tenant data.
