# Architecture

## Current foundation

InstituteOS is a modular monolith. The repository has a React/Vite browser application in `apps/web` and a Node.js/Express REST API in `apps/api`. They are separate application entry points in one product repository; the API is not split into microservices.

The API uses TypeScript with ES modules. Its intended request flow is:

```text
HTTP request -> request ID / logging / security / CORS / rate limit
  -> /api/v1 route -> controller -> service -> repository -> model -> MongoDB
```

The API provides operational endpoints at `GET /api/v1`, `GET /api/v1/health`, and `GET /api/v1/ready`, plus the authentication endpoints under `/api/v1/auth`. Unknown paths receive structured errors through centralized error handling.

The HTTP listener starts independently of MongoDB. An initial database failure is logged without exposing the connection URI, readiness remains unavailable, and connection attempts retry. Once connected, Mongoose manages connection recovery. Shutdown closes the HTTP listener and database connection, with a bounded timeout.

Cross-cutting middleware assigns a validated or generated request ID, logs route templates and response metadata without query strings or headers, sets Helmet security headers, applies an origin allowlist, parses bounded JSON bodies, and rate-limits API requests. Health and readiness probes are excluded from rate limiting. The default rate-limit store is process-local; deployments with multiple API instances should configure a shared store.

The frontend is a React application served by Vite, with React Router role-layout previews, TanStack Query providers, a centralized typed API client, and reusable UI primitives for forms, tables, paging, dialogs, notifications, and common page states. React Hook Form and Zod provide the form validation foundation. The role selector is explicitly a layout preview; it is not an authorization control. During local development, `/api` requests are proxied to the API process.

## Authentication and identity

Authentication is a modular API feature under `apps/api/src/modules/auth`. Its request flow is route/controller -> authentication middleware -> service -> repository -> Mongoose models. User passwords are hashed with Node.js scrypt and per-password random salts. Password reset and email-verification credentials are high-entropy, one-time tokens; only SHA-256 hashes and expirations are stored. Responses expose a small public-user projection.

Email verification and login establish opaque server-side sessions. Registration returns a generic response and requires a separate sign-in when verification is disabled, reducing account-existence disclosure. Only a hash of the random session token is stored. The browser receives the session in an HttpOnly, SameSite=Strict cookie (Secure by default in production) and a separate readable CSRF cookie; authenticated state-changing requests must echo the CSRF token in `X-CSRF-Token`. Sessions have a configurable fixed lifetime and are revoked on logout, password reset, and password change. This foundation answers identity only; role previews are not authorization and no tenant or RBAC policy is applied.

Email verification is required by default in production and disabled by default in development. Verification and reset email delivery use Nodemailer over SMTP. Delivery is enabled only when `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` are configured; `SMTP_PORT` and `SMTP_SECURE` select the provider connection settings. Set `AUTH_WEB_APP_URL` to a frontend address that email recipients can reach. These names are listed without credentials in `.env.example`. For a verification-required registration, configure SMTP before enabling that flow. Forgot-password responses are deliberately generic to avoid account enumeration, including when delivery is unavailable.

## Multi-tenancy and authorization

An Organization is the tenant boundary. `OrganizationMembership` links an authenticated user to an organization with one organization-scoped role and an active, suspended, or revoked status. A compound unique index on `{ organizationId, userId }` prevents duplicate memberships and supports the membership lookup used for tenant resolution. A user can hold memberships in multiple organizations. This phase adds the persistence models and authorization primitives; it does not add organization creation or membership administration workflows.

Organization roles and permissions are defined centrally in `apps/api/src/modules/tenancy/authorization.ts`. The permission catalog is atomic and role grants are explicit; there is no implicit role inheritance. Phase 05 adds organization profile and status administration, campus management, membership administration, and invitation flows on top of the Phase 04 authorization primitives. No student, finance, or other business endpoints are introduced here.

Authenticated organization requests resolve `:organizationId` against an active organization and the current user's active membership. The route parameter is only a requested context; arbitrary IDs, headers, or body fields do not establish access. Missing, suspended, archived, and revoked contexts return a non-disclosing 404. Permission and role failures return structured 403 responses. Tenant-owned repository access receives the resolved organization context and sends both organization and resource identifiers to its data store. Business repositories must preserve this compound filter.

Platform Super Admin is represented by a separately granted `PlatformRoleGrant`, not an organization membership or a permission inherited by organization roles. A platform grant does not bypass membership checks or grant unrestricted organization data access. Platform operations must add explicit platform permissions and scoped data access when such endpoints are designed.

Organization management routes resolve membership and permissions server-side. Campus Admin access is restricted to assigned campus IDs for campus operations; membership changes and organization settings remain organization-admin operations. Organization owners are protected from removal or demotion when that would leave no active owner. Platform organization status changes use a separately authorized platform route and do not grant general access to tenant data.

The frontend provides onboarding, organization dashboard/settings, campuses, members, invitations, and invitation acceptance pages. These screens use the API's current-user and tenant context and are presentation surfaces; server-side authorization remains authoritative.

### Tenancy indexes and startup

The membership and platform grant uniqueness constraints are declared on their Mongoose schemas. Phase 05 adds schema indexes for organization campuses, invitations, and audit events. The API uses Mongoose's current `autoCreate` and `autoIndex` defaults; `connectDatabase()` explicitly awaits initialization of the organization, membership, platform grant, campus, invitation, and audit models before reporting database readiness. Development startup can therefore create empty collections and their schema indexes without inserting records. A failed model or index initialization leaves readiness unavailable and causes the connection attempt to fail. There is no migration or index-management framework yet, so deployments with existing production data must account for the current automatic index initialization behavior before rollout.

Organization onboarding writes the organization, optional initial campus, initial owner membership, and audit event in one MongoDB transaction. Membership and campus updates are tenant scoped and write an organization audit event in the same transaction. Invitations store only a hash of a random one-time token; the raw token is delivered through the configured email adapter and is not returned in API responses. Invitation acceptance verifies the signed-in email, expiration, active organization, and single-use state in a transaction. MongoDB deployments used for onboarding and invitation transactions must support transactions (for example, Atlas replica sets).

The versioned API exposes organization onboarding at `POST /api/v1/organizations`, organization profile/dashboard/settings and campus/member/invitation operations under `/api/v1/organizations/:organizationId`, invitation acceptance at `/api/v1/organizations/invitations/accept`, and platform-only organization status changes at `/api/v1/platform/organizations/:organizationId/status`. Mutating browser-cookie requests require the existing CSRF token. The Phase 05 `OrganizationAuditEvent` is a narrow event hook for onboarding and administrative mutations; the future full audit-log capability can consume or replace this integration without logging credentials or invitation tokens.

## Module boundaries

As business capabilities are added, keep their code inside feature modules and route requests through middleware, controllers, services, repositories/data access, and models where the behavior warrants those layers. Organization-owned records must be scoped and authorization enforced on the server. Shared code should remain small and cross-cutting.

MongoDB through Mongoose is the configured data store. Domain repositories and models belong to their feature phases. SaaS subscription billing and institute fee collection remain separate domains.

## Configuration and quality

Copy the root `.env.example` to `.env` for local configuration. The API validates numeric settings and loads the root environment file. Set `MONGODB_URI` through secret management outside local development. SMTP delivery uses `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`; configure `AUTH_WEB_APP_URL` for recipient-accessible verification and reset links. Only the environment variable names and safe defaults are in `.env.example`; never place real secrets there or in source control. `AUTH_COOKIE_SECURE` defaults on in production and cannot be disabled there. Set `API_TRUST_PROXY_HOPS` to the exact number of trusted reverse-proxy hops when deployed behind a proxy; leave it at `0` otherwise. The frontend reads Vite-prefixed variables from the root environment file.

The root npm workspace provides shared linting and formatting. Each application provides build, test, and typecheck scripts; root scripts run those across applicable workspaces.

## Deferred capabilities

Phase 05 adds organization and campus administration, invitations, membership management, and organization audit events. Admissions, students and guardians, academics, attendance, finance, communication, documents, billing, and AI remain deferred to their assigned phases.
