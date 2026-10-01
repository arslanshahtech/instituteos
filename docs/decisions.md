# Architecture decisions

## 2026-09-29 — Start as a TypeScript npm-workspace modular monolith

**Status:** Accepted

The repository contained project instructions and numbered phase prompts but no application source, package manifest, or working stack to preserve. We therefore established new TypeScript applications: React/Vite for the frontend and Express for the API, managed as npm workspaces in one repository. TypeScript is justified for a new codebase and keeps both application boundaries consistently typed. Separate workspace packages support independent build and deployment without creating service boundaries or distributed runtime infrastructure.

## 2026-09-29 — Keep Phase 00 deliberately small (superseded by Phase 01)

**Status:** Superseded by Phase 01

At the end of Phase 00, the API had only version-root and liveness endpoints, structured 404 handling, and a basic HTTP bootstrap. Phase 01 adds the operational API and database foundation described below; authentication and domain modules remain deferred.

## 2026-09-29 — Add operational API and MongoDB foundation in Phase 01

**Status:** Accepted

The API remains a single Express application. MongoDB connects through Mongoose using environment configuration; the HTTP listener remains available if MongoDB is down, while readiness returns 503 and connection attempts retry. Requests receive correlation IDs, safe route-template logs, Helmet headers, configured CORS, bounded JSON parsing, centralized structured errors, and an API rate limit. The default rate limiter uses in-memory state and must be replaced with a shared store when the API is deployed across multiple instances. No authentication, authorization, or business module is introduced in this phase.

## 2026-09-29 — Establish a shared React application shell in Phase 02

**Status:** Accepted

The frontend uses React Router for five role-oriented layout previews, TanStack Query for server state, and a centralized API client. Shared controls and feedback patterns are implemented as accessible React/CSS primitives, with React Hook Form and Zod for validated forms. The role selector is presentation-only and does not claim to enforce authorization. No education business pages or data were added.

## 2026-09-30 — Use opaque MongoDB-backed sessions for Phase 03 identity

**Status:** Accepted

Login and registration issue random opaque session credentials in HttpOnly, SameSite=Strict cookies. The API stores only a SHA-256 token hash with a bounded expiry; authenticated writes also require a separate session-bound CSRF token. This keeps browser JavaScript away from the session credential while allowing session revocation and current-user bootstrap. Passwords use Node.js scrypt with per-password salts. Reset and verification credentials are one-time, stored as hashes, and delivered through a configurable SMTP adapter. Local development can complete registration without email verification; production requires verification by default. Organization memberships, tenant resolution, and role/permission authorization were established in Phase 04.

## 2026-09-30 — Resolve organization context through active membership in Phase 04

An organization ID supplied by a request is only a context request. The API must verify an active organization and the authenticated user's active membership before exposing organization context or accessing tenant-owned data. Memberships are unique by organization and user and carry one explicitly mapped organization role. Permission sets are centralized and do not inherit implicitly. Platform Super Admin grants are stored separately from organization memberships and never bypass tenant checks. This phase adds the models, middleware, context endpoint, and generic organization-scoped repository boundary; organization/member administration and business resources remain deferred.

## 2026-10-01 — Await tenancy model initialization before database readiness

Organization, OrganizationMembership, and PlatformRoleGrant use schema-declared Mongoose indexes. The API relies on the current Mongoose `autoCreate` and `autoIndex` defaults and now explicitly awaits those models' initialization after connecting. Readiness remains false until the declared collection and index initialization completes; initialization failure disconnects and follows the existing retry path. This is the current schema-driven initialization strategy, not a migration system. A controlled development startup can create empty tenancy collections and indexes without seeding organizations, memberships, or platform grants.
