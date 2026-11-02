# InstituteOS — Phase 3 Teacher Workspace

## Goal
Deliver a secure, usable Teacher Workspace for real institute staff. A teacher must be linked to exactly one active staff profile in the organization and may access only their assigned classes, students, attendance and academic tasks.

## User-approved scope
1. Teacher invitation and account activation.
2. Correct and durable link between the teacher login account and the existing staff profile.
3. Only assigned classes and their student rosters.
4. Student attendance statuses: Present, Absent, Late and Leave.
5. Teacher self-attendance view and optional self-marking, controlled by institute policy.
6. Attendance history and assigned academic tasks.
7. Server-side denial of access to other classes, students and Admin setup.

## Existing implementation found during initial audit
- Teacher role layout and dashboard already exist.
- Teacher routes already exist for assigned students, student attendance, examinations, homework/tests and communications.
- `TeacherStudentsPage` loads the teacher's assignments and requests a roster for the selected assignment.
- Attendance API has a teacher-only assignments endpoint; student roster and attendance endpoints permit the teacher role.
- Attendance service checks the teacher's assignment before returning a roster, saving a roll-call or reading history for a section.
- Student attendance already supports `present`, `absent`, `late` and `leave`; bulk attendance requires the full active roster and rejects foreign/missing students.
- Teacher assignments are currently resolved by matching the authenticated user's email to one active staff record. Ambiguous or missing matches fail closed.
- Organization invitations are generic role-based invitations. Accepting an invitation currently creates/activates a membership; a durable staff-profile link is not established by the invitation acceptance flow.
- Staff attendance endpoints are currently manager-only. Teacher self-attendance endpoints and a policy setting were not found in the initial route audit.

## Implementation workstreams

### 1. Staff-account identity link
- Add an explicit optional `userId` reference to staff records, scoped by organization.
- Add a safe, unique-per-organization constraint for linked active accounts.
- On teacher invitation acceptance, resolve the existing staff profile by normalized invitation email within the same organization.
- Require exactly one eligible active teaching staff profile for a teacher invitation; reject missing or ambiguous matches with a clear actionable error rather than silently linking the wrong person.
- Link the accepted user account to that staff profile in the same transaction as membership activation and invitation acceptance.
- Update teacher assignment resolution to use the explicit user link; retain email matching only as a carefully controlled legacy migration/fallback, and never if ambiguous.
- Add tests for correct linking, duplicate email/profile ambiguity, wrong organization, non-teaching staff, inactive staff, invitation replay and existing-account activation.

### 2. Assigned workspace and data isolation
- Audit every Teacher route and API, including student roster, attendance, examinations, homework/tests and communications.
- Enforce organization, campus, active academic year, staff identity and assignment scope in the API/service/repository layer.
- Verify direct URL/API attempts for unassigned classes, other students, Admin settings, staff management and organization setup are denied.
- Keep read-only roster data minimal; do not expose guardian/private student fields unless explicitly required for teaching and authorized.

### 3. Student roll-call and history
- Preserve the four existing student statuses and current full-roster validation.
- Verify teacher can only save attendance for an assigned class/section/year and can only include students in that roster.
- Verify attendance history filters cannot be used to retrieve another teacher's section or another campus.
- Add/extend tests for date validation, duplicate rows, roster mismatch, cross-section IDs and unauthorized history queries.

### 4. Teacher self-attendance and institute policy
- Define an organization-level policy with a secure default: self-marking disabled until explicitly enabled by an authorized Owner/Admin.
- Policy should specify whether teachers may view their own attendance and whether they may self-mark; do not let teachers change the policy.
- Add teacher-scoped endpoints that derive staff identity from the authenticated membership link; never accept an arbitrary staffId from the teacher as authority.
- Enforce allowed dates/time window, duplicate prevention, status vocabulary and audit trail. Manager corrections remain separate from teacher self-marking.
- Decide whether a teacher can mark `present` only or request a leave/absence status; final behavior must follow institute policy and be documented before UI implementation.

### 5. Academic tasks
- Audit Homework/Tests and Examination APIs for teacher-specific assignment scope.
- Teachers should see only tasks/exams for their assigned class/subject/section and academic year.
- Keep Admin creation/configuration routes inaccessible to teachers unless a specific teacher permission is intentionally introduced.

### 6. UI, accessibility and responsive behavior
- Make teacher navigation show only teacher workspace destinations.
- Provide clear loading, empty, error and permission-denied states.
- Ensure the workspace works on common mobile screen sizes used by teachers.
- Do not expose Admin setup controls in teacher UI; API authorization remains authoritative.

## Acceptance checklist
- [x] Owner/Admin can invite a teacher only when a matching active teaching staff profile exists.
- [x] Invitation activation links the correct staff profile and membership atomically.
- [x] Missing, duplicate or cross-organization matches cannot link the wrong profile.
- [x] Teacher dashboard and assigned classes load from the linked account (automated route/service verification).
- [x] Roster contains only currently assigned class/section/year students (service authorization tests).
- [x] Teacher can mark Present, Absent, Late and Leave only for their assigned roster (service tests).
- [x] Attendance history is limited to assigned sections.
- [x] Self-attendance view/marking follows explicit institute policy and derives staff identity server-side.
- [x] Teacher sees only assigned academic tasks/exams (service and route authorization tests).
- [x] Direct API attempts against unassigned homework scope, parent-only actions and Admin exam setup are denied by route tests.
- [x] API/Web typecheck, ESLint, production builds, focused API/Web tests and diff checks pass.
- [ ] Browser verification uses a synthetic teacher account and synthetic records; no real records are altered.

## Safety and repository rules
- Preserve all existing uncommitted Phase 2 work.
- No reset, clean, bulk formatting, commit, push or destructive database operation without explicit approval.
- Do not use production data for tests. Use synthetic teacher/student records in a disposable test/staging environment.
- Phase 3 is not complete until automated tests and teacher-account browser verification both pass.

## Current status
- Initial code audit complete; existing Owner/Admin, Teacher and Parent workspaces are preserved.
- **Implemented (identity and invitation):** staff profiles have an explicit organization-scoped `userId` link. Teacher invitation acceptance resolves exactly one active teaching staff profile by normalized email and links it in the same transaction as membership activation; missing, ambiguous, already-linked and cross-organization matches fail closed.
- **Implemented (teacher account and routing):** the existing common login, invitation activation and role-based workspace routing are retained. An authenticated teacher is routed to the Teacher workspace and sees the Teaching overview with teacher-only quick actions. Teacher navigation includes classes/students, attendance, Homework & Tests, Examinations & Marks, and Messages.
- **Implemented (assignment isolation):** teacher assignment resolution uses the durable staff `userId` link first. A guarded legacy email fallback remains for old memberships, excluding staff profiles already linked to another account and failing closed on ambiguous matches. Student roster, roll-call and history remain assignment-scoped.
- **Implemented (attendance):** Present, Absent, Late and Leave remain supported for student roll-call. Teacher self-attendance history is served through a teacher-only endpoint that derives staff identity from the signed-in account; self-marking is policy-controlled, limited to the institute's current date, and cannot overwrite an existing mark. The database's unique organization/staff/date index also prevents concurrent duplicate marks. Each self-mark writes a `TEACHER_SELF_ATTENDANCE_MARKED` audit record.
- **Implemented (policy UI):** Owner/Admin can configure teacher attendance history visibility, self-marking, and allowed staff statuses under Settings → Teacher attendance. Secure defaults are history visible, self-marking disabled, and Present as the only allowed status. Teachers cannot edit the policy.
- **Verified (academic and communication scope):** Homework/Tests teacher identity and assignment checks use the linked staff profile; unassigned teachers receive no work records and cannot create work outside their assigned class/section/subject/year. Teachers can read examination information and assigned schedules/marks, while structural exam and grading-scale management remains manager-only. Teacher messaging is permitted through the authenticated messaging service; organization-wide announcement management and parent-initiated conversation creation remain unavailable to teachers.
- **New authorization regression tests:** teacher self-attendance read/write and CSRF protection; parent denial; Homework/Tests unassigned scope and parent denial; Examination teacher read, marks entry and manager-only setup; Communications teacher thread read/reply and restricted actions.
- **Automated verification:** API and Web typechecks passed; API and Web production builds passed; API and Web ESLint passed. The latest focused API suite passed 43 tests across attendance, settings, Homework/Tests, Communications and Examinations. Focused Web tests passed the teacher workspace route, Settings policy tab and attendance dashboard permission checks. The full `app.test.tsx` run passed 45/46 tests; the remaining logout/cache-clear assertion is intermittent (it passes when run individually) and is not a Teacher Workspace failure. `git diff --check` and targeted Prettier checks passed.
- **Still outstanding before Phase 3 can be declared complete:** investigate the Web logout/cache-clear test failure and perform a real browser walkthrough with a synthetic teacher account and synthetic institute records (login, invitation activation, assigned class, student roll-call, self-attendance, Homework/Tests, Examination marks and messaging), including mobile-width checks. Do not use real school records for this verification.


## Independent re-audit — 2026-11-02

- Rechecked the Phase 3 implementation against the approved teacher scope, including staff-account linking, role routing, assigned roster/roll-call, teacher self-attendance policy, Homework & Tests, examinations/marks, communications, and server-side organization/campus/assignment authorization.
- **Gap found and fixed:** teacher student-attendance history checked the assigned section but did not constrain the query to the academic year(s) in which that teacher is assigned to that exact section. The service now derives allowed academic-year IDs from the authenticated teacher's assignments; the repository applies an academic-year `$in` filter. The browser/API caller cannot supply this internal allow-list. The teacher dashboard query key now includes section + academic-year identity so cached history is invalidated when assignment-year scope changes.
- Added regression coverage for assignment-derived academic-year restrictions, denial when no matching section assignment exists, and the repository's academic-year query filter.
- **Post-fix API verification:** 9 focused suites passed, 74 tests passed (attendance, Homework/Tests, examinations, communications, organizations and tenancy).
- **Post-fix quality gates:** API/Web typecheck, repository-wide ESLint, API/Web production builds, targeted Prettier check, and `git diff --check` passed. The frontend build reports dependency annotation warnings from Zod/Rollup but completes successfully.
- **Web focused verification:** 4 focused files ran; 52 tests passed and 1 existing application-shell logout/cache-clear assertion failed in the grouped run. That logout test passes when run alone. The teacher-workspace route test, attendance dashboard permission tests, settings tests and permission helper tests passed. This remaining grouped-run failure is not a teacher-workspace assertion, but should be tracked separately before declaring the entire Web suite green.
- **Still required for Phase 3 sign-off:** run the manual browser walkthrough with a disposable staging organization, synthetic Owner/Admin + Teacher accounts, and synthetic students. Verify desktop and mobile widths. Do not use the `.env` database until its environment is positively confirmed as disposable staging; no live database writes were performed during this audit.
- No Phase 4 work was started. No commit, push, reset, clean, or destructive database operation was performed. Existing working-tree changes outside Phase 3 were preserved.


## Final automated re-verification — 2026-11-02

- Full repository API suite: **232/232 tests passed** across 32 files.
- Full repository Web suite: **119/119 tests passed** across 18 files. The previously intermittent grouped logout/cache-clear assertion passed in this full run.
- Repository-wide `npm run typecheck`: passed.
- Repository-wide `npm run build`: passed for API and Web. Existing Zod/Rollup dependency annotation warnings are non-fatal.
- Repository-wide `npm run lint`: passed.
- Role/permission regression coverage remains green in the full run, including tenant isolation, owner-assigned Admin permissions, explicit role checks, teacher self-attendance policy, teacher assignment scope, Parent-only access denial, and manager-only configuration routes.
- Local staging smoke: API liveness, frontend-origin CORS with credentials, API readiness/database-connected response, and frontend HTML response all passed. The smoke script was corrected to validate the API's actual readiness response shape (`status=ready`, `checks.database=connected`).
- **Final remaining acceptance gate:** authenticated browser walkthrough with synthetic Owner/Admin, Teacher and Parent accounts plus 390px/768px visual checks. Automated tests and unauthenticated staging smoke do not replace this manual role-by-role workflow verification. No synthetic records were created in this pass.
- Phase 3 implementation and automated quality gates are green; keep the phase's status as **implemented — manual browser acceptance pending** until the walkthrough is evidenced.
