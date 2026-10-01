# InstituteOS — Project State

Update this file after every accepted phase.

## Current phase

Phase: 05 — Organizations, campuses, and member administration
Status: Ready to close; awaiting human acceptance and checkpoint

## Last completed phase

Phase 04 — Multi-tenancy and RBAC implementation is present; acceptance tracking remains owner controlled in `PROMPT_INDEX.md`.

## Current milestone

Phase 05 final review

## Verified commands

- `npm run test --workspace @instituteos/api -- src/modules/organizations/organizations.test.ts src/modules/auth/auth.service.test.ts src/modules/auth/auth.routes.test.ts src/modules/tenancy/tenancy.test.ts` — 25 passed
- `npm test` — API 36 passed; web 15 passed
- `npm run lint` — passed
- `npm run typecheck` — passed
- `npm run build` — passed
- `npm run format:check` — passed
- `git diff --check` — passed
- Built API `GET /api/v1/health` and `GET /api/v1/ready` — both 200 against development Atlas
- Development Atlas Phase 04/05 declared indexes — present and schema-aligned
- Disposable live API lifecycle/security check — passed; temporary identities, organizations, campuses, memberships, invitations, sessions, and audit events cleaned up

## Known issues

- Interactive browser verification was not performed; use the Phase 05 manual checklist from the final review.
- Vite reports a non-blocking bundle-size warning and dependency annotation notices during build.

## Architecture decisions

- See `docs/architecture.md` and `docs/decisions.md` for the modular-monolith, tenancy, onboarding, invitation, and index-initialization decisions.

## Important implementation notes

- The development Atlas has no Phase 05 test records remaining. The live integration check captured invitation email in memory and did not send SMTP mail.
- `prompts/05-organizations-campuses-users.md` contains the intentionally expanded Phase 05 canonical prompt; it was preserved during review.

## Next phase

Phase 06 only after the owner accepts Phase 05 and updates `PROMPT_INDEX.md`.
