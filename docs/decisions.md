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

## 2026-10-01 — Add organization, campus, and membership administration in Phase 05

**Status:** Accepted

Phase 05 builds organization onboarding and administration on the existing tenancy boundary. Onboarding creates the organization, optional initial campus, initial owner membership, and audit record atomically. Campus and membership operations require tenant context and explicit permissions; Campus Admin campus operations are further limited to assigned campuses. Invitations use random one-time credentials whose hashes alone are persisted, and acceptance is bound to the authenticated user's email. Last-active-owner protections prevent removal or demotion of the final active organization owner. The API initializes the new schemas and indexes before readiness, following the existing schema-driven development strategy; a separate migration framework remains future work.

## 2026-10-02 — Close Phase 05 organization discovery and audit consistency

**Status:** Accepted

The authenticated organization directory is derived only from the current user's active memberships joined to active organizations. It returns only the organization identity and the user's role; it accepts no user ID and does not itself grant access. `/admin` opens the only accessible organization directly and otherwise displays discovery. The workspace switcher uses the same server response, performs navigation only, and does not persist an organization selection. A stale/inaccessible organization context falls back to discovery; every workspace API request still resolves membership and permission server-side.

Organization settings/status, campus create/update, membership changes, invitation creation, invitation acceptance, and onboarding persist their Phase 05 audit event in the same narrowly scoped MongoDB transaction as the related mutation. This reconciles the implementation with the documented audit contract; no general audit or transaction framework is introduced. Administrator cancellation of pending invitations is deferred because the canonical Phase 05 prompt does not require it.

The earlier authentication-test timeouts occurred during a full test run launched concurrently with typecheck, lint, and formatting work. The two Scrypt-heavy cases passed in isolated execution and a subsequent normal `npm test` run passed both workspaces without changing the test timeout or password-hash behavior. This is treated as local CPU/resource contention; final verification commands should be run sequentially.

## 2026-10-09 — Connect Student Management to the tenant-scoped People API

**Status:** Accepted

The Student Management frontend uses the existing organization-scoped People endpoints for server-side search, status filtering, pagination, detail, create, and update. Organization permissions gate access and mutation actions; the backend remains authoritative. Campus Admin operations additionally use membership campus IDs: records outside assigned campuses and records without a campus are not readable or editable, and creating a student requires an assigned campus. The UI only offers campus assignments from the authenticated organization's campus listing and requires a campus choice for Campus Admins. No student-specific endpoint or client-selected organization authorization mechanism is introduced.

## 2026-10-10 — Keep Phase 07 Academics scoped inside the existing tenant boundary

**Status:** Accepted

Academic Years, Terms, Classes, Sections, Subjects, and Teacher Assignments are owned by one organization and every read/write query includes that organization. Academics management is limited server-side to organization owners/admins, campus admins, principals/directors, and academic coordinators without expanding the Phase 00–06 permission catalog. Campus admins and memberships with campus assignments can only access classes, sections, and assignments for their assigned campuses; campus IDs are resolved to campus names by a narrow Academics endpoint. Classes require an active campus, and tenant-owned relationships are validated before writes.

Teacher assignments have no timetable periods in this phase, so time-slot collision cannot be computed. To prevent overlapping assignments with the available data, a teacher may only have one subject assignment for a given class, section, and academic year. An organization-scoped unique index enforces the same invariant atomically in addition to the service conflict check. Parent records with dependent Terms, Sections, or Teacher Assignments cannot be deleted.

## 2026-10-10 — Keep student class placement owned by Attendance in Phase 08

**Status:** Accepted

The existing People enrollment records do not identify an academic year, class, or section. Attendance therefore owns a student-to-class/section placement record keyed uniquely by organization, student, and academic year rather than expanding the Phase 00–06 People schemas. Attendance marking requires an active student enrollment at the selected campus, an active academic year containing the attendance date, and a placement in the selected section. Bulk submissions must cover the complete active section roster. Student and staff records remain tenant-scoped, and campus-assigned memberships are restricted to their assigned campuses. Timetable-based attendance checks and automated enrollment-to-class placement remain deferred.

## 2026-10-02 — Require owner-controlled archive before organization deletion

**Status:** Accepted

Organization lifecycle operations are deliberately separate from ordinary tenant permissions. Only an active organization owner may archive an active organization, restore an archived one, or permanently delete it. Deletion requires the organization to be archived and the exact, case-sensitive organization name as confirmation. The cleanup is a single transaction scoped to Phase 05-owned organization data: campuses, memberships, invitations, existing organization audit events, and the organization record. It leaves global user accounts, platform role grants, and other organizations untouched, and writes one final `organization.deleted` audit event after removing prior events. Archived workspaces remain visible to their active owners for recovery, but are excluded from active workspace routing and switching.

## 2026-10-11 — Keep Phase 10 student billing inside tenant and academic placement boundaries

**Status:** Accepted

Finance structures, invoices, and payment receipts are organization-owned and every read or write is scoped by the active organization membership. Campus assignments restrict both queries and mutations. Finance read/write permissions are granted to organization owners/admins, campus admins, principals/directors, and finance officers; other organization roles do not gain finance access implicitly. Bulk invoices include only active students with an active enrollment and a current active class placement for the academic year. Fee and invoice amounts are persisted as MongoDB Decimal128 and accepted only to cents; optional fee heads are excluded from generated invoice totals. An organization/student/fee-structure/billing-cycle unique index makes generation repeat-safe. Payment collection updates invoice balance and writes its receipt together in a MongoDB transaction, with tenant-scoped conditional balance checks to reject stale or over-balance writes.
