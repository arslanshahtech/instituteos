# PROMPT 05 — ORGANIZATIONS, CAMPUSES & USER ADMINISTRATION

Execute only organization administration and onboarding.

Read `AGENTS.md`.

## Implement

Organization:
- create
- profile
- settings
- status

Campus:
- create
- edit
- activation/deactivation
- settings
- contact/address data
- campus scope

Membership:
- invite
- accept
- deactivate
- reactivate where appropriate
- role assignment
- campus assignment
- member status

Onboarding:
- organization creation
- initial campus
- initial owner/admin
- configuration foundation

Frontend:
- onboarding
- organization dashboard
- organization settings
- campuses
- members
- invitations
- role/permission overview

## Business rules

- Owner has full organization authority
- Campus Admin is restricted to assigned campus
- Platform Super Admin is outside normal tenant boundaries
- Deactivated members cannot perform normal operations
- Important membership changes are auditable

## Do not implement

Students, academics, finance, billing, AI, exams.

## Acceptance criteria

- organization creation works
- campus management works
- member management works
- role/campus scopes work
- onboarding works
- tenant and permission security remains intact
- tests/typecheck/lint/build pass where applicable
