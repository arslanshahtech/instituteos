# InstituteOS — Phase 2 Execution Plan

## Phase

- ID: Phase 2 — Organization Admin / Owner
- Goal: Deliver a coherent, permission-safe organization administration workspace using existing InstituteOS modules.
- Scope: Institute setup/overview; students, guardians, teachers and staff; campuses/classes/sections/academic years; teacher assignments and guardian-child links; permission-aware access to existing attendance, examinations, fees, reports and settings.
- Out of scope: Phase 3 Teacher workspace, Phase 4 Parent workspace/app, React Native apps, student promotion/history UI, timetable conflict-engine expansion, payroll/accounting expansion, AI assistant, replacing the design system, and production data migrations without an approved plan. Parent-child relationship data and privacy checks remain in Phase 2 because they are explicitly in acceptance point 4.

## Six acceptance points

1. Institute setup and organization overview work with real organization-scoped data.
2. Existing student, guardian, teacher and staff management workflows work, including validation and duplicate/relationship safeguards.
3. Campuses, academic years, classes and sections can be managed with safe lifecycle and data-integrity rules.
4. Teachers can be assigned to valid subjects/classes/sections/years, and parents are linked only to their verified children.
5. Existing attendance, examinations, fees, reports and settings modules remain available and enforce the correct Owner/Admin permissions at the API boundary.
6. End-to-end role, tenant and campus boundaries, error/empty/loading states, responsive usability and regression tests are verified; no existing module is hidden or removed.

## Current audit findings

- Organization setup, campus/member administration, invitations and owner-assigned Admin permissions already exist in the working tree; review and verify rather than rebuild.
- Student/guardian/staff CRUD and guardian-to-multiple-child relationships already exist; staging acceptance remains pending.
- Academic years, terms, classes, sections, subjects, placements and teacher assignments exist. Subject-to-class validation is implemented for new records.
- **Implemented:** activating a new academic year archives the previous active year and activates the selected year inside one MongoDB transaction. The one-active-year partial unique index remains the final database invariant.
- **Implemented:** class display ordering is stored, validated and applied by the class-list query; section capacity changes and new placements share a transactional section lock, with capacity checked per academic year.
- **Implemented:** teacher assignment accepts active teaching staff (teaching designation or assigned subjects), not arbitrary non-teaching staff; parent portal child resolution is organization-scoped and returns only linked children.
- **Implemented:** Admin read/write permission states for Academics, Attendance and Settings; existing Examinations is directly linked in Admin navigation, and all existing Phase 2 modules remain present.
- Student promotion/history UI and timetable section/room conflict-engine expansion are explicitly deferred because they are not among the six Phase 2 acceptance points.
- MongoDB Windows service is stopped and its configured binary path currently points to a missing `D:\\bin\\mongod.exe`. Live persistence/concurrency/browser-to-database acceptance is blocked until a valid disposable staging MongoDB replica set is available. No database was started or modified.

## Implementation sequence

1. Reconcile organization setup, owner/admin permission assignment and campus/member workflows against current API and UI.
2. Verify student, guardian, staff and teacher management, including guardian-child linking and duplicate handling.
3. Complete academic setup and relationships: academic-year lifecycle, class ordering, section capacity, subject applicability and teaching-staff-only teacher assignment.
4. Complete guardian-child linking/privacy and verify the existing student, guardian, teacher and staff management workflows.
5. Verify existing attendance, examinations, fees, reports and settings navigation plus Owner/Admin read/write permissions. Keep every module present.
6. Run regression tests, typecheck, lint, build, formatting and `git diff --check`; perform live staging/browser/database acceptance only when a non-production replica set is available.

## Verification status — final automated run (2026-11-01)

- **API tests:** PASS — 204/204 tests across 28 files.
- **Web tests:** PASS — 115/115 tests across 17 files. The staff/student route tests now allow realistic lazy-page loading time; no tests were skipped.
- **Typecheck:** PASS — API and Web workspaces.
- **Lint:** PASS — repository ESLint command.
- **Production build:** PASS — API TypeScript build and Web Vite production build. Vite reports non-fatal Rollup annotation warnings inside the installed Zod dependency.
- **Whitespace/diff check:** PASS — `git diff --check`.
- **Formatting:** repository-wide `npm run format:check` is NOT CLEAN; Prettier reports 131 files across the repository. The new academic permission helper and its test were formatted. No repository-wide auto-format was run because it would create broad unrelated diffs.
- **Student placement permission reconciliation:** PASS — UI gating now matches the existing API: roster reads require `student.read` + `attendance.read`; placement actions additionally require `student.create`, `staff.read` and `attendance.write`. Attendance-aware roster data is not exposed through a weaker UI permission check.
- **Live MongoDB/browser-to-database acceptance:** BLOCKED — Windows MongoDB service is stopped; no `mongod.exe` was found at the configured path or under Program Files; Docker is unavailable; no staging API/web endpoints or staging credentials are configured in the environment. Therefore transactional persistence, replica-set concurrency, refresh/re-login persistence and real-account browser workflows could not be run. No database was started, installed, seeded or modified.
- **Phase 2 overall:** IMPLEMENTATION + AUTOMATED VERIFICATION PASS; LIVE STAGING ACCEPTANCE BLOCKED. Do not mark the phase production-complete until a disposable non-production MongoDB replica set and authorized staging access are available and the six-point E2E checklist passes.

## Six acceptance points — evidence status

1. **Institute setup and organization overview:** automated API/UI coverage PASS; real organization data and browser-to-database acceptance BLOCKED pending staging.
2. **Students, guardians, teachers and staff:** automated API/UI coverage PASS, including guardian-child relationships, campus scoping and student import coverage; live persistence/real-account acceptance BLOCKED pending staging.
3. **Campuses, academic years, classes and sections:** implementation and automated lifecycle, ordering, validation and capacity tests PASS; MongoDB transaction/concurrency acceptance BLOCKED pending a replica set.
4. **Teacher assignment and parent-child linking:** automated assignment validation and organization-scoped guardian-link/privacy tests PASS; real-account portal acceptance BLOCKED pending staging.
5. **Attendance, examinations, fees, reports and settings:** module navigation and API permission-boundary regression coverage PASS; live role-matrix acceptance BLOCKED pending staging.
6. **Role/tenant/campus boundaries, states, responsiveness and preservation of modules:** automated authorization, error/empty/loading, navigation and mobile-navigation coverage PASS; manual responsive/browser review and live tenant-isolation acceptance BLOCKED pending staging.

## Decisions

- Preserve all existing uncommitted work. No commit, push, reset or destructive cleanup without explicit instruction.
- Owner retains highest authority. Admin uses only permissions assigned by Owner; server-side authorization is authoritative.
- Existing modules must remain visible/available where the role has access. A denied action should show a permission-denied state, not remove the module from the product.
- Do not claim staging or production acceptance based only on mocked automated tests.

## Completion evidence

**Recorded:** API 204/204, Web 115/115, typecheck, lint, production build and `git diff --check` pass. The exact six-point automated evidence and limitations are recorded above.

**Still required before Phase 2 closure:** provide a disposable non-production MongoDB replica set and authorized staging web/API access; seed synthetic institute/student/guardian/teacher records; run the six acceptance workflows through the browser and API; verify persistence after refresh/re-login, tenant/campus isolation and transaction/concurrency behavior; then obtain institute-owner approval. Do not use production data for this test.
