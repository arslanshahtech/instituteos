# PROMPT 05 — ORGANIZATIONS, CAMPUSES & USER ADMINISTRATION

Act as a Senior Software Engineer and Product Engineer implementing Phase 05 of InstituteOS.

Follow the root AGENTS.md as the permanent repository constitution.

This is the canonical Phase 05 implementation task.

==================================================
PHASE 05 GOAL
==================================================

Build the organization administration and onboarding layer on top of the completed Phase 03 Authentication and Phase 04 Multi-Tenancy + RBAC foundation.

Phase 04 already provides:

- authenticated users
- organizations/tenant model
- organization memberships
- platform role grants
- roles
- permissions
- tenant resolution
- server-side authorization
- tenant-scoped repository boundaries
- cross-tenant protection

Do NOT rebuild these systems.

Integrate Phase 05 with them.

The goal is to make organizations, campuses, and organization members operationally manageable.

==================================================
PHASE 05 SCOPE
==================================================

Implement ONLY:

1. Organization management
2. Campus management
3. Organization membership administration
4. Member invitations
5. Member acceptance
6. Member activation/deactivation/reactivation where appropriate
7. Role assignment
8. Campus assignment/scope
9. Organization onboarding
10. Basic organization administration UI
11. Basic organization settings
12. Tests and documentation

Do NOT implement later business domains.

==================================================
DO NOT IMPLEMENT
==================================================

Do NOT build:

- students
- guardians
- admissions
- teachers as a business domain
- academics
- timetable
- attendance
- exams
- assignments
- finance
- billing
- communication platform
- documents
- reports
- AI assistant
- transport
- library
- HR/payroll
- hostel

Do not implement speculative features from future phases.

==================================================
ARCHITECTURE PRINCIPLE
==================================================

Preserve the current modular-monolith architecture.

React frontend
→ Node.js + Express REST API
→ module services
→ Mongoose
→ MongoDB

Do not introduce microservices.

Use the existing Phase 04 tenancy and authorization primitives.

Do not create a parallel organization or authorization architecture.

==================================================
ORGANIZATION
==================================================

Implement organization administration for an authenticated user with appropriate organization-level authority.

Organization capabilities:

- create organization
- view organization profile
- update organization profile
- update organization settings
- manage organization status only where the current role is authorized
- view organization context

Organization data must remain tenant-scoped.

Never trust a client-supplied organization ID by itself.

Every organization operation must verify:

authenticated user
→ organization membership / platform authority
→ role / permission
→ organization context

Organization status must be respected by all protected organization operations.

A suspended or archived organization must not behave like an active organization.

==================================================
ORGANIZATION CREATION / ONBOARDING
==================================================

The onboarding flow should support:

1. authenticated user starts organization creation
2. organization is created
3. creator becomes the initial Organization Owner
4. initial organization membership is created
5. initial campus can be configured during onboarding
6. initial configuration foundation is created
7. user reaches the organization dashboard

The creator must not have to manually create their own initial membership after creating the organization.

Prefer an atomic/transactional provisioning strategy where supported by the current MongoDB/Mongoose architecture so that organization creation does not leave partially initialized onboarding state.

If transactions are used, keep them limited to the onboarding provisioning operation.

Do not introduce a general transaction framework.

==================================================
INITIAL CAMPUS
==================================================

Onboarding should support creation of an initial campus when appropriate.

The initial campus should belong to exactly one organization.

Campus information may include:

- name
- status
- address
- contact information

Do not add academic/business fields that belong to later phases.

Organization creation and campus creation must preserve tenant boundaries.

==================================================
CAMPUS MANAGEMENT
==================================================

Implement:

- create campus
- view campus
- edit campus
- activate campus
- deactivate campus
- campus settings
- address/contact data

Every campus must belong to exactly one organization.

A campus from Organization A must never be accessible through Organization B.

Campus operations must use tenant-scoped database access.

Do not trust a raw campus ID without validating its organization context.

==================================================
MEMBERSHIP ADMINISTRATION
==================================================

Use the existing Phase 04 OrganizationMembership model as the foundation.

Implement:

- list organization members
- view member details appropriate to the role
- invite member
- accept invitation
- deactivate member
- reactivate member where appropriate
- assign/change organization role
- assign/remove campus scope
- view membership status

Membership remains tied to:

User
+
Organization
+
Role
+
Status
+
Campus scope where applicable

Do not create duplicate memberships.

Respect the Phase 04 organization/user uniqueness constraint.

==================================================
MEMBER STATUS
==================================================

At minimum support the current membership lifecycle:

- active
- suspended
- revoked

Use the existing model/status terminology where already established.

A deactivated/revoked member must not perform normal organization operations.

Authorization must be enforced server-side.

Frontend disabling/hiding controls is not sufficient.

==================================================
ROLE ASSIGNMENT
==================================================

Use only the approved InstituteOS organization roles.

Current organization roles include:

- Organization Owner
- Organization Admin
- Campus Admin
- Principal/Director
- Academic Coordinator
- Teacher
- Accountant/Finance Officer
- Admissions/Reception
- Student
- Parent/Guardian

Platform Super Admin is NOT an ordinary organization role.

Do not invent additional roles.

Do not introduce implicit role inheritance unless already established by Phase 04.

Permissions remain the source of authorization capability.

Changing a user's role must immediately affect future authorization decisions.

==================================================
ORGANIZATION OWNER
==================================================

Organization Owner has full organization-level authority within the boundaries defined by the existing permission system.

Owner capabilities should include appropriate organization administration, campus administration, and membership administration.

Do not allow an organization owner to obtain platform-level privileges.

Do not confuse organization ownership with Platform Super Admin privileges.

Protect against accidentally removing the last usable organization owner if the system's business rules require an owner to remain.

If owner-transfer is required to safely support owner removal/deactivation, implement the minimum safe rule needed for organizational integrity and document it.

Do not build an elaborate ownership-transfer system unless genuinely necessary.

==================================================
ORGANIZATION ADMIN
==================================================

Organization Admin has organization-level administrative capabilities allowed by the permission system.

Do not automatically grant permissions that have not been defined.

Do not treat frontend role labels as authorization.

==================================================
CAMPUS ADMIN / CAMPUS SCOPE
==================================================

Campus Admin must be restricted to assigned campus scope.

A Campus Admin assigned to Campus A must not access Campus B resources unless explicitly authorized by the current permission architecture.

If a member has multiple campus assignments, authorization must resolve the requested campus against the member's allowed campus scope.

Do not rely on URL parameters alone.

Do not allow:

organizationId
+
campusId

to bypass membership/permission checks.

==================================================
PLATFORM SUPER ADMIN
==================================================

Platform Super Admin remains outside normal organization membership boundaries.

Do not convert Platform Super Admin into an organization member.

Do not silently grant all organization permissions merely because the user has a platform role.

If a platform-level operation legitimately needs organization access, it must use an explicit platform authorization path.

Preserve the Phase 04 separation between:

Platform scope

and

Organization scope.

==================================================
INVITATION SYSTEM
==================================================

Implement secure member invitations.

Invitation flow:

authorized organization member
→ create invitation
→ invitation token generated
→ secure token representation stored
→ invitation email sent
→ recipient opens invitation
→ recipient accepts
→ membership becomes active

Do not store raw invitation tokens if the existing authentication/security architecture expects hash-only token storage.

Invitation tokens must be:

- random
- expiring
- single-use
- safely stored
- invalidated after acceptance

Do not expose invitation tokens in API responses or logs beyond the actual invitation URL/email flow.

Do not log sensitive invitation credentials.

Use the existing email delivery architecture already configured for InstituteOS.

Do not introduce another email provider.

If the current email service abstraction supports invitation emails, extend it rather than creating a second email system.

==================================================
INVITATION SECURITY
==================================================

Handle safely:

- expired invitation
- invalid invitation
- already-used invitation
- already-member user
- duplicate/pending invitation
- suspended/revoked membership
- unauthorized invitation creation

Do not expose unnecessary account-existence information.

Use predictable/safe error responses.

==================================================
MEMBER ROLE / CAMPUS CHANGES
==================================================

Role and campus-scope changes are security-sensitive.

After a role or campus assignment changes:

- subsequent authorization decisions must use the new state
- revoked/suspended members must lose normal access
- removed campus scope must stop access to that campus
- permission changes must not depend on stale frontend state

Invalidate/refresh any cached authorization state where the current architecture requires it.

Do not create a new authorization cache system unless necessary.

==================================================
ORGANIZATION SETTINGS
==================================================

Implement the minimum organization settings required for Phase 05.

Possible settings:

- organization name
- contact information
- address
- timezone where already supported
- basic operational preferences needed by current onboarding

Do not create finance, academic, attendance, notification, or billing settings yet.

Keep settings extensible without creating a large settings framework prematurely.

==================================================
CAMPUS SETTINGS
==================================================

Implement only basic campus settings needed now:

- campus name
- status
- address
- contact information

Avoid future academic/operational settings.

==================================================
AUDITABILITY
==================================================

Important membership changes must be auditable.

Do NOT implement the entire Phase 10 Audit Logs module.

Instead:

- reuse an existing audit/event abstraction if already present
- or establish only the smallest Phase 05-compatible audit hook needed for important membership mutations
- document the integration point for the future full Audit Logs module

Important actions include where applicable:

- invitation creation
- invitation acceptance
- role change
- campus assignment/removal
- member deactivation
- member reactivation
- ownership changes

Do not log passwords, invitation tokens, session tokens, API keys, or other secrets.

==================================================
API DESIGN
==================================================

Use `/api/v1`.

Keep controllers thin.

Follow:

Request
→ Authentication
→ Tenant Resolution
→ Authorization
→ Validation
→ Controller
→ Service
→ Repository
→ Model
→ Database

Use the existing error-handling conventions.

Use consistent status codes.

Examples:

401 = unauthenticated
403 = authenticated but unauthorized
404 = inaccessible/non-disclosing resource where appropriate
409 = conflict
422 = invalid/business input where consistent with current API conventions

Do not change status codes solely to make tests pass.

==================================================
FRONTEND
==================================================

Implement the minimum functional frontend for Phase 05.

Required UI areas:

- onboarding
- organization dashboard
- organization settings
- campuses
- members
- invitations
- role/campus administration
- permission/role overview where useful

Use the existing application shell, routing, providers, API client, and Phase 04 organization context.

Do not create a parallel layout system.

Frontend authorization checks are UX only.

The API is the final security boundary.

Provide appropriate:

- loading states
- empty states
- error states
- forbidden states
- validation states
- success feedback

Do not build decorative complexity.

==================================================
ORGANIZATION DASHBOARD
==================================================

Create a functional organization dashboard showing real current organization data.

Do NOT create fake business metrics.

The dashboard may show lightweight operational information such as:

- organization name
- active campus count
- active member count
- onboarding/setup status

Only show values that come from the real API/database.

Do not build student/finance/academic analytics in this phase.

==================================================
VALIDATION
==================================================

Validate all organization, campus, membership, and invitation inputs.

At minimum validate:

- names
- status values
- identifiers
- email addresses
- role values
- campus assignments
- invitation data
- address/contact fields where implemented

Reject malformed or unauthorized requests before business operations occur.

==================================================
DATABASE / INDEXES
==================================================

Preserve Phase 04 indexes.

Use appropriate indexes for new Phase 05 queries.

Potential uniqueness/integrity rules should include:

- organization/user membership uniqueness
- organization/campus identity where logically required
- pending invitation uniqueness where logically required

Do not create arbitrary indexes.

If new indexes are introduced:

- declare them in the schema
- verify them in the development Atlas database
- add appropriate tests/documentation

==================================================
TENANT SECURITY
==================================================

This is mandatory.

Prove that:

Organization A
→ cannot read Organization B organization data

Organization A
→ cannot modify Organization B organization data

Organization A
→ cannot read Organization B campuses

Organization A
→ cannot modify Organization B campuses

Organization A admin
→ cannot manage Organization B members

Campus Admin for Campus A
→ cannot access Campus B administrative data

Revoked member
→ cannot perform normal organization operations

Suspended organization
→ cannot be used as an active organization context

A valid-looking foreign organization/campus/member ID
→ cannot bypass authorization

Do not weaken security to make UI operations succeed.

==================================================
BUSINESS INTEGRITY TESTS
==================================================

Cover at minimum:

1. authenticated user creates organization
2. creator becomes owner
3. organization creation is tenant-scoped
4. initial onboarding succeeds
5. initial campus creation works
6. campus CRUD/activation works
7. organization settings work
8. member list is tenant-scoped
9. invitation creation requires permission
10. invitation acceptance works
11. expired invitation fails
12. used invitation fails
13. duplicate membership is prevented
14. role assignment works
15. role change affects authorization
16. campus assignment works
17. campus scope is enforced
18. revoked/suspended member loses access
19. reactivation works where allowed
20. cross-tenant organization access is denied
21. cross-tenant campus access is denied
22. cross-tenant membership administration is denied
23. platform and organization scopes remain separate
24. important membership mutations are auditable according to the implemented Phase 05 hook

==================================================
FRONTEND TESTS
==================================================

Cover the main Phase 05 UI behavior:

- onboarding renders
- organization context loads
- dashboard loads real organization data
- settings forms validate
- campus list/create/edit behavior
- members list
- invitation flow UI
- role/campus controls
- forbidden states
- loading/error/empty states

Do not over-test presentation details.

==================================================
BACKEND TESTS
==================================================

Use focused API/service/integration-style tests.

Prefer the existing test utilities and adapters.

Security tests must prove authorization outcomes rather than only checking helper functions in isolation.

==================================================
REAL DATABASE VERIFICATION
==================================================

After implementation:

- verify the development Atlas database remains healthy
- verify new schema indexes where introduced
- verify Phase 04 indexes remain intact

Do not seed unrelated business data.

If temporary verification data is needed, use an isolated/disposable database whenever practical.

Do not modify production data.

==================================================
DOCUMENTATION
==================================================

Update only relevant documentation.

Document:

- organization lifecycle
- campus lifecycle
- membership lifecycle
- invitation lifecycle
- role/campus scope behavior
- onboarding flow
- ownership rules
- important security decisions
- audit integration point
- new API behavior
- important database/index decisions

Do not document future functionality as implemented.

==================================================
IMPLEMENTATION DISCIPLINE
==================================================

Before editing:

1. inspect the current Phase 03 authentication implementation
2. inspect Phase 04 tenancy/authorization models
3. inspect existing organization context route
4. inspect current frontend routing/layout
5. inspect existing tests
6. inspect current database connection/startup behavior
7. form a concise implementation plan

Then implement the smallest coherent Phase 05 change set.

Do not rewrite working Phase 03/04 code.

Do not duplicate authentication.
Do not duplicate authorization.
Do not duplicate organization context.
Do not create parallel models when an existing model can be extended safely.

==================================================
VERIFICATION
==================================================

Run:

1. focused Phase 05 tests
2. Phase 03 auth regression tests
3. Phase 04 tenancy/RBAC regression tests
4. full test suite
5. typecheck
6. lint
7. build
8. format check
9. git diff --check

Also manually verify the main browser flows.

Do not claim success without actual command output.

==================================================
PHASE 05 DEFINITION OF DONE
==================================================

Phase 05 is complete only when:

Requirement
→ UI
→ API
→ Database
→ Business logic
→ Validation
→ Authorization
→ Tenant isolation
→ Error handling
→ Tests
→ Verification
→ Documentation

all work together.

Acceptance checklist:

- organization creation works
- creator becomes initial owner
- onboarding works
- initial campus works
- campus management works
- organization settings work
- member management works
- invitation works
- invitation acceptance works
- role assignment works
- campus assignment works
- member status lifecycle works
- Campus Admin scope works
- Owner authority works
- Platform Super Admin remains separate
- cross-tenant protection remains intact
- Phase 04 security remains intact
- relevant indexes are verified
- tests pass
- typecheck passes
- lint passes
- build passes
- formatting passes
- documentation matches implementation

==================================================
SCOPE CONTROL
==================================================

If a requirement is discovered that belongs to Phase 06 or later:

- document it
- do not silently implement it
- continue Phase 05 without scope drift

If the current code architecture creates a genuine dependency on a future phase, implement only the minimum abstraction required and document the dependency.

==================================================
GIT
==================================================

Do NOT commit automatically.

Report the final Git status and changed files.

The human owner will review the diff and create the Phase 05 checkpoint.

==================================================
FINAL OUTPUT
==================================================

Return:

1. IMPLEMENTED CHANGES
2. ORGANIZATION MODEL/WORKFLOW
3. CAMPUS MODEL/WORKFLOW
4. MEMBERSHIP WORKFLOW
5. INVITATION WORKFLOW
6. ONBOARDING FLOW
7. ROLE/CAMPUS AUTHORIZATION
8. TENANT ISOLATION RESULTS
9. AUDITABILITY IMPLEMENTATION
10. API ENDPOINT SUMMARY
11. FRONTEND IMPLEMENTATION SUMMARY
12. DATABASE/INDEX CHANGES
13. TEST RESULTS
14. TYPECHECK/LINT/BUILD/FORMAT RESULTS
15. DOCUMENTATION UPDATED
16. REMAINING ISSUES
17. PHASE 05 ACCEPTANCE STATUS

Acceptance status must be exactly one of:

READY FOR REVIEW
NOT READY
COMPLETE

Do not mark COMPLETE without evidence.