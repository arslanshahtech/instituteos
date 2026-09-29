# InstituteOS — Repository Instructions

## Project

InstituteOS is a multi-tenant education management and operations SaaS for schools, school groups, colleges, academies, coaching institutes, and multi-campus education organizations.

The initial architecture is a modular monolith:

React frontend
→ Node.js + Express REST API
→ modular services
→ Mongoose
→ MongoDB

Do not introduce microservices unless explicitly requested.

## Product priorities

Core domains:
- auth and identity
- organizations and campuses
- memberships, roles, permissions
- admissions
- students and guardians
- staff and teachers
- academics
- timetable
- attendance
- exams/results
- assignments
- finance
- communication
- documents
- reports
- SaaS billing
- audit logs
- AI assistant

## Roles

Platform Super Admin
Organization Owner
Organization Admin
Campus Admin
Principal/Director
Academic Coordinator
Teacher
Accountant/Finance Officer
Admissions/Reception
Student
Parent/Guardian

Future roles can be added later; do not implement them early.

## Architecture rules

Use clear module boundaries.

Backend request flow:

Request
→ Route
→ Authentication
→ Tenant Resolution
→ Authorization
→ Validation
→ Controller
→ Service
→ Repository/Data Access
→ Model
→ Database

Keep business logic out of controllers where practical.

Prefer feature/module ownership over large global utility files.

API version prefix:

`/api/v1`

## Multi-tenancy

Organization-owned data must always be tenant scoped.

Never trust a client-supplied organization ID without verifying membership and authorization.

Protect against IDOR and cross-tenant access.

Authorization must be enforced server-side. Frontend hiding alone is never a security control.

## Financial rules

InstituteOS SaaS subscription billing and student/institute fee collection are separate domains.

Avoid unsafe floating-point money calculations.

Billing events/webhooks must be idempotent.

## AI rules

AI is an authorized application capability, not an unrestricted database shell.

Never give an LLM unrestricted database access.

Use explicit/allowlisted tools and validate tool arguments.

AI tool execution must inherit normal tenant and permission boundaries.

Protect against prompt injection, data leakage, unauthorized tool use, and unsafe outputs.

## Security

Use:
- secure authentication/session design
- server-side authorization
- validation
- rate limiting where appropriate
- secure headers
- controlled CORS
- secrets through environment variables
- secure file handling
- safe logging
- audit logging for important mutations
- least-privilege access

Never commit secrets.

Never log passwords, tokens, API keys, or other sensitive authentication material.

## Engineering discipline

- Inspect existing code before editing.
- Preserve working unrelated code.
- Avoid unnecessary rewrites.
- Do not implement future phases early.
- Prefer small, coherent changes.
- Add or update tests for behavior changes.
- Run relevant tests after changes.
- Run typecheck/lint/build when applicable.
- Do not claim success without evidence.
- Record important architecture decisions in `docs/decisions.md`.
- Keep documentation aligned with the actual implementation.

## UI

InstituteOS is a premium B2B SaaS, not a toy dashboard.

Prioritize:
- accessibility
- responsiveness
- clear information hierarchy
- professional data tables
- useful empty states
- useful loading states
- useful error states
- useful permission-denied states
- restrained visual effects

Avoid:
- decorative complexity
- fake metrics
- excessive gradients
- excessive rounded cards
- unnecessary animation

## Definition of done

A feature is not done merely because code was generated.

Definition of done:

Requirement
→ UI
→ API
→ database
→ business logic
→ validation
→ authorization
→ error handling
→ tests
→ verification
→ documentation

## Phase discipline

The project uses numbered execution prompts.

Complete the current phase before moving to the next phase.

If a future feature is discovered as necessary but belongs to a later phase, document it and do not silently implement it.

## Working style for AI agents

When a task is complex:
1. inspect only the files relevant to the task
2. form a concise implementation plan
3. make the smallest coherent set of changes
4. run verification
5. summarize changes and evidence

Do not repeatedly dump or reread the entire repository when a focused inspection is sufficient.

## Sources of truth

The current working repository is the source of truth for implementation state.

`AGENTS.md` is the project-rule source of truth.

The current phase prompt is the task source of truth.

If documentation conflicts with working code, stop and reconcile the inconsistency rather than silently choosing one.

## Git

Do not commit automatically unless explicitly instructed.

Before major changes, prefer a clean Git working tree or a deliberate checkpoint.

## Human ownership

The AI can implement code.

The human owner retains responsibility for reviewing changes, understanding critical behavior, and deciding whether a phase is accepted.
