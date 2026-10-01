Act as a Senior Software Engineer and Security Architect implementing Phase 04 of InstituteOS.

Follow the root AGENTS.md as the permanent project constitution.

==================================================
PHASE 04 — MULTI-TENANCY + RBAC
==================================================

Goal:

Build the foundational multi-tenant authorization layer for InstituteOS.

This phase establishes:

1. Organization/Tenant context
2. Membership model
3. Roles
4. Permissions
5. Server-side authorization
6. Tenant isolation
7. Resource access boundaries
8. Regression/security tests

IMPORTANT:

This is a security-sensitive phase.

Do not treat frontend hiding as authorization.

The server must enforce tenant and permission boundaries.

Do not implement Phase 05 business functionality except for the minimum model/test fixtures required to establish the Phase 04 security foundation.

Do NOT build:
- full organization management UI
- campus management UI
- student management
- admissions
- academics
- attendance
- exams
- finance
- billing
- AI assistant

Those belong to later phases.

==================================================
CURRENT VERIFIED STATE
==================================================

Phase 03 Authentication is complete.

Current authentication provides:

- registration
- login
- password hashing
- sessions
- logout
- password change
- forgot password
- password reset
- email delivery
- email verification architecture
- auth middleware
- /auth/me
- protected frontend routes
- rate limiting
- authentication tests

The current Git checkpoint is:

5bfef6e
"InstituteOS: complete phase 03 authentication"

The working tree is clean.

Preserve the current authentication system.

Do not rewrite it unless an actual Phase 04 integration issue requires a minimal change.

==================================================
TARGET MULTI-TENANT MODEL
==================================================

InstituteOS is a multi-tenant SaaS.

A tenant is an Organization.

Organization-owned data must never be accessible across organizations unless an explicit platform-level capability is designed later.

Core relationship:

User
→ Membership
→ Organization
→ Role
→ Permissions

A user may eventually belong to more than one organization.

Do not assume one user permanently belongs to exactly one organization.

==================================================
ROLES
==================================================

Use the currently approved InstituteOS role set where applicable:

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

Do not add speculative roles.

Do not implement every role's business features yet.

The Phase 04 objective is to establish the authorization model.

==================================================
RBAC DESIGN
==================================================

Implement a clear RBAC foundation.

Distinguish:

Role
→ collection/set of permissions

Permission
→ atomic capability

Examples:

organization.read
organization.update
member.read
member.invite
student.read
student.create
finance.read

Do not create an unnecessarily huge permission matrix in this phase.

Define a clear permission model that can grow safely.

Keep permission ownership centralized.

Avoid hard-coding authorization checks throughout unrelated controllers.

==================================================
ORGANIZATION / MEMBERSHIP MODEL
==================================================

Create the minimum backend data structures required for:

Organization
Membership
Role / permission relationship

The Membership relationship should establish:

User
Organization
Role
Status where needed

A future user may belong to multiple organizations.

Do not move all organization management into Phase 04.

This phase establishes the security primitives that later Phase 05 will use.

==================================================
TENANT RESOLUTION
==================================================

Implement a reliable tenant-resolution mechanism.

The request lifecycle should follow:

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

Do not trust arbitrary client organization IDs.

Tenant context must be derived from authenticated identity and verified membership/authorization.

If the API accepts an organization identifier in a route/header/body/query, treat it only as a requested context and verify it server-side.

Do not allow:

authenticated user
→ arbitrary organization ID
→ data access

without membership/authorization validation.

==================================================
AUTHORIZATION MIDDLEWARE
==================================================

Implement reusable server-side authorization middleware/helpers for:

1. authentication
2. organization context
3. required role where appropriate
4. required permission where appropriate

Authorization should answer:

"Is this authenticated user allowed to perform this operation within this organization?"

Do not duplicate authorization logic in every controller unnecessarily.

Keep controllers thin.

Business authorization should remain close to the service/domain boundary where practical.

==================================================
TENANT ISOLATION
==================================================

This is one of the most important deliverables of Phase 04.

Create tests proving:

Organization A user
→ can access Organization A resource

Organization A user
→ cannot read Organization B resource

Organization A user
→ cannot modify Organization B resource

Organization B user
→ cannot access Organization A resource

A valid-looking resource ID from another tenant must not bypass tenant isolation.

Protect against IDOR / insecure direct object references.

Where tenant-owned repositories/services are created, require organization context in database queries.

Prefer queries shaped conceptually like:

organizationId + resourceId

rather than:

resourceId only

Do not rely on frontend restrictions.

==================================================
PLATFORM SUPER ADMIN
==================================================

Treat Platform Super Admin as a special platform-level role.

Do not incorrectly make it an ordinary organization member if the architecture requires platform scope.

Clearly document the difference between:

Platform-level authorization

and

Organization-level authorization.

Do not implement unrestricted data access without explicit architectural justification.

==================================================
ROLE HIERARCHY
==================================================

Do not assume that role names automatically imply permission inheritance.

Make role capability explicit.

If role inheritance is implemented, document it clearly and test it.

Avoid hidden authorization behavior.

==================================================
FRONTEND
==================================================

Implement only the minimum frontend integration necessary to demonstrate:

- current authenticated user
- current organization context if available
- permission-aware route/page protection
- forbidden state
- safe organization switching behavior only if required by the current architecture

Do not build the complete organization administration UI.

Do not build organization CRUD screens in this phase.

Frontend permission checks are UX only.

The API remains the final security boundary.

==================================================
ERROR HANDLING
==================================================

Use consistent responses.

Examples:

Unauthenticated
→ 401

Authenticated but missing organization membership
→ 403 or an intentionally non-disclosing 404 depending on resource semantics

Authenticated but lacking permission
→ 403

Invalid tenant/resource combination
→ safe response without leaking another tenant's data

Do not reveal sensitive cross-tenant information.

==================================================
DATABASE / INDEXING
==================================================

For membership and tenant-owned data introduced in this phase:

Inspect and add appropriate indexes.

Consider uniqueness constraints such as:

organization + user

where logically required.

Do not create indexes merely because they sound useful.

Use indexes that support actual authorization/data-access patterns.

==================================================
TEST STRATEGY
==================================================

Create focused tests for:

1. authenticated user with valid membership
2. authenticated user without membership
3. valid organization context
4. invalid organization context
5. required role
6. required permission
7. denied permission
8. Organization A reading Organization A resource
9. Organization A reading Organization B resource
10. Organization A modifying Organization B resource
11. Organization B accessing Organization A resource
12. IDOR attempt using another tenant's resource ID
13. platform-level authorization distinction
14. multiple memberships where architecture permits
15. inactive/revoked membership if supported

Tests must prove the security boundary, not only the happy path.

==================================================
SECURITY REQUIREMENTS
==================================================

Do not:

- trust client organization IDs
- trust frontend permission flags
- use hidden UI as authorization
- expose another tenant's resource existence unnecessarily
- duplicate authorization logic everywhere
- grant broad platform access accidentally
- log sensitive tenant data unnecessarily

Follow least privilege.

Keep security decisions documented.

==================================================
DOCUMENTATION
==================================================

Update the appropriate architecture/security documentation.

Document:

- tenant model
- membership model
- role model
- permission model
- tenant-resolution flow
- authorization flow
- platform vs organization scope
- important security decisions

Keep documentation aligned with actual code.

Do not invent future features.

==================================================
IMPLEMENTATION DISCIPLINE
==================================================

Before editing:

1. Inspect current authentication implementation.
2. Inspect current project structure.
3. Inspect existing auth models/services/middleware.
4. Inspect existing tests.
5. Form a concise implementation plan.

Then implement the smallest coherent Phase 04 changes.

Do not repeatedly scan the entire repository unnecessarily.

Do not modify unrelated files.

Do not introduce microservices.

Do not add unnecessary dependencies.

==================================================
VERIFICATION
==================================================

After implementation run:

1. focused Phase 04 tests
2. full test suite
3. typecheck
4. lint
5. build
6. formatting/checks used by the repository

Also perform at least one practical integration/security verification proving cross-tenant access is denied.

Do not claim success without command output.

==================================================
PHASE 04 DEFINITION OF DONE
==================================================

Phase 04 is complete only when:

Requirement
→ tenant model
→ membership
→ role
→ permission
→ tenant resolution
→ authorization
→ database filtering
→ cross-tenant protection
→ error handling
→ tests
→ verification
→ documentation

all work together.

==================================================
OUTPUT FORMAT
==================================================

Return:

1. IMPLEMENTED CHANGES
2. ARCHITECTURE
3. TENANT MODEL
4. MEMBERSHIP MODEL
5. RBAC MODEL
6. AUTHORIZATION FLOW
7. TENANT ISOLATION RESULT
8. SECURITY TEST RESULTS
9. FULL TEST RESULTS
10. TYPECHECK / LINT / BUILD RESULTS
11. DOCUMENTATION UPDATED
12. REMAINING ISSUES
13. PHASE 04 ACCEPTANCE STATUS

Acceptance status must be one of:

READY FOR REVIEW
NOT READY
COMPLETE

Do not mark COMPLETE without evidence.

Do not commit Git changes automatically.