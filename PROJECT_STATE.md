# InstituteOS — Project State

Update this file after every accepted phase.

## Current phase

Phase: 06 — Admissions, students, guardians, and staff
Status: Ready to start; Phase 05 has been accepted by the human owner.

## Last completed phase

Phase 05 — Organizations, campuses, and member administration
Accepted by the human owner. Checkpoint: `5e07241` (`InstituteOS: complete phase 05`).

## Current milestone

Phase 06 — People domain. Not started.

## Current verification

- `npm test` — API 52 passed; web 30 passed
- `npm run typecheck` — passed
- `npm run lint` — passed
- `npm run build` — passed
- `npm run format:check` — passed
- `git diff --check` — passed
- API lifecycle coverage includes owner-only archive/restore/delete routes, CSRF enforcement, exact-name confirmation, archive-before-delete, transactional organization-scoped cleanup, and retained deletion audit.
- Frontend tests cover owner-only archive controls, archive confirmation/navigation, archived owner restore/delete, exact-name gating, and non-owner lifecycle control hiding.

These checks were run sequentially. An earlier run that launched the full test suite concurrently with typecheck, lint, and format checks hit two 5-second Scrypt test timeouts. The same cases passed in isolation and the subsequent sequential full root suite passed without changing timeout settings or production password hashing. This indicates test-run resource contention; no repository-side test fixture failure was found.

## Known issues and deliberate deferrals

- Human acceptance verified organization discovery/switching, settings, archive/restore, permanent delete, and mobile and desktop UI, including final mobile polish.
- Vite emits non-blocking dependency annotation notices and a bundle-size warning during build.
- Administrative cancellation of pending invitations is deferred: the canonical Phase 05 prompt requires safe invitation creation, listing, acceptance, and duplicate/pending handling, but does not require cancellation.
- No Phase 06 domain has been implemented.
- Organization settings/status, campus creation/update, membership changes, invitations, and onboarding now write their Phase 05 audit event in the same MongoDB transaction as the mutation. MongoDB deployments must support transactions.
- Owner-only archive/restore and archived-first permanent deletion have been added. Deletion removes only organization-owned Phase 05 campuses, memberships, invitations, previous audit events, and the organization, retaining one final `organization.deleted` event while preserving global users, platform grants, and other organizations.

## Architecture decisions

See `docs/architecture.md` and `docs/decisions.md` for modular-monolith, tenancy, organization discovery, invitation, audit-transaction, and index-initialization decisions.

## Important implementation notes

- The organization directory is derived server-side from the current user's active memberships; active organizations are listed for members, and archived organizations are listed only for active owners. It returns organization identity, role, and status; it does not grant workspace access.
- `/admin` opens a sole active organization directly and otherwise displays discovery. The workspace selector navigates among active accessible organizations and does not persist authorization state.
- An inaccessible organization context returns the user to discovery. All organization API requests continue to enforce tenant membership and permissions server-side.
- Phase 00 has no separate recorded checkpoint; the prompt index identifies it as superseded by Phase 01 rather than fabricating a completion commit.

## Next phase

Phase 06 status: **READY — NOT STARTED**. Phase 05 is accepted and its checkpoint exists; Phase 06 work has not begun.
