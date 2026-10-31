# Academic Setup — Step 2: Final Requirements & Gap Analysis

**Status:** Step 2 requirements baseline (not implementation)  
**Scope:** School and college academic structure for InstituteOS  
**Decision:** Academic year + terms/periods. A semester-specific workflow is not required for the current release.  
**Rule:** Existing uncommitted work must be preserved. No production data may be used for synthetic testing.

## 1. Audit baseline and confidence

The Step 1 review found existing Academic Year, Term, Class, Section, Subject, Teacher Assignment and Teacher Timetable models/workflows, plus a separate student placement workflow. Existing routes, services, repositories, UI panels, CSS and tests are present.

Static code presence does not prove end-to-end correctness. Unless explicitly marked otherwise below, real database persistence, browser workflows, organization isolation and role permissions remain **Not Verified**.

Observed gaps/risks from Step 1:
- API academic test suite: 18 passed, 1 failed in a recently added timetable-reference repository test because `recordId` and `organizationId` are out of scope.
- API TypeScript check: failed in the same current work area; rerun after the test-scope defect is resolved.
- Web TypeScript check: passed.
- Subject department is represented as text; a separate department entity is not established.
- Dedicated class ordering field/workflow was not found.
- Multiple active academic years, overlapping terms, section capacity enforcement and safe active-year switching were not proven.
- Teacher timetable CRUD has route-level direct model access; architecture/service boundary and conflict integrity need review.
- Cross-module reference checks were recently expanded; actual model field compatibility and real-data behavior are not yet proven.
- Public SEO metadata was not fully present in the reviewed web entry point. The authenticated academic workspace itself is not intended to be indexed.

## 2. Release scope decisions

### In scope for this release
1. Academic years and safe active-year lifecycle.
2. Terms/periods inside an academic year (not a mandatory semester model).
3. Classes and sections.
4. Subjects and their class applicability/department categorization.
5. Student placement into year, class and section, with history.
6. Teacher-to-subject/class/section assignments.
7. Teacher timetable references and conflict protection where already supported.
8. Permissions, organization/campus isolation, validation, auditability and safe deletion/archive behavior.
9. Automated and practical verification using synthetic test data in a confirmed non-production environment.

### Explicitly deferred unless a genuine pilot requirement is identified
- Dedicated semester-management product workflow.
- Complex department hierarchy and department administration screens.
- Advanced class promotion automation and bulk migration from legacy school software.
- React Native parent/teacher/admin applications.
- Public SEO work for authenticated Academic Setup pages.
- New academic features unrelated to closing the existing scope.

## 3. Final requirements and acceptance criteria

### A. Academic Year — P0, production-critical
Required:
- Create, view/list, update, activate, deactivate and archive academic years.
- Store a clear session label and start/end dates.
- Validate start date before end date; prevent invalid or unintended overlapping sessions according to the institute's policy.
- Enforce at most one active academic year per organization (and campus if the product's data model defines active year at campus level).
- Switching active year must be deliberate, authorized and atomic; historical records must remain attached to their original year.
- Do not hard-delete a year with dependent operational records; archive/deactivate safely instead.

Acceptance:
- CRUD and state transitions work through UI and API.
- Duplicate session and invalid dates are rejected with understandable messages.
- Two concurrent activation attempts cannot leave two active years.
- Switching year does not rewrite or hide historical placements, attendance, fees, exams or reports.
- Unauthorized users cannot activate/archive; organization/campus boundaries are enforced.

### B. Terms / Periods — P0, production-critical
Required:
- Create/list/update/archive terms within one academic year.
- Store name/label, start/end dates, order and academic-year reference.
- Dates must fall within the parent academic year.
- Define and enforce the overlap policy. Default release rule: no overlapping terms within the same academic year unless an explicit product decision approves it.
- Exams and other dependent records must protect referenced terms from destructive deletion.

Acceptance:
- Invalid parent year/date range and duplicate term labels/order are rejected.
- Overlap behavior is tested at boundaries (same-day end/start included).
- Referenced terms cannot be hard-deleted.
- Term records remain correctly linked after year archive.

### C. Classes — P0, production-critical
Required:
- Create/list/update/archive classes with display name, stable code and display order.
- Support school and college naming (e.g. Nursery, Prep, Class 1–10, Intermediate Part I/II) without hardcoding one country's grade labels.
- Prevent duplicate class codes/names within the intended organization/campus scope.
- Preserve class references used by sections, placements, attendance, fees, exams and homework.

Acceptance:
- Duplicate and invalid class data rejected.
- Ordering is stable in UI and API.
- A class with dependent records cannot be destructively deleted.
- Campus/organization visibility is correct.

### D. Sections — P0, production-critical
Required:
- Create/list/update/archive sections under a class (e.g. 5-A, 5-B).
- Store section code/name and optional capacity.
- Prevent duplicate section identifiers within a class.
- Enforce capacity when assigning/enrolling students if capacity is enabled; define whether pending/inactive students count.
- Preserve links to placements, attendance, exam schedules and homework.

Acceptance:
- A section cannot be attached to the wrong class/organization.
- Duplicate section blocked.
- Capacity boundary tested (below, exactly at, above capacity).
- Referenced sections cannot be hard-deleted.

### E. Subjects and department categorization — P1, required for a usable release
Required:
- Create/list/update/archive subjects with stable code and display name.
- Define which classes a subject applies to and use that mapping in teacher assignment/exam workflows.
- Department/category may remain a controlled text/category value for this release if a separate department entity is not justified; standardize validation and avoid arbitrary inconsistent labels.
- Prevent duplicate subject codes in the defined scope.
- Protect subjects referenced by assignments, exams and homework.

Acceptance:
- Subject-to-class applicability is enforced when assigning teachers or scheduling relevant academic work.
- Duplicate codes and invalid mappings rejected.
- Archived/used subjects remain available in historical records.

### F. Student placement / enrollment — P0, production-critical
Required:
- Place an existing student in an academic year, class and section.
- Prevent duplicate active placement for the same student in the same academic year.
- Validate that section belongs to selected class and all records belong to the same organization/campus scope.
- Support promotion/transfer through a new placement or controlled update while preserving prior-year history.
- Do not silently move or overwrite historic attendance, invoices, exam results or other records.

Acceptance:
- Create, view, change/transfer and historical placement workflows tested.
- Duplicate and invalid class-section-year combinations rejected.
- Reload/re-login confirms persistence.
- Prior-year placement and dependent records remain unchanged after promotion.

### G. Teacher assignments — P0, production-critical
Required:
- Assign a teacher to a subject, class, section and academic year (where section-level assignment is supported).
- Validate teacher, subject, class, section and year belong to the same organization/campus scope.
- Validate subject is applicable to the selected class.
- Prevent duplicate assignments and detect conflicting assignment combinations according to the institute's policy.
- Preserve historical assignments; protect records referenced by timetable entries.

Acceptance:
- Valid assignment can be created, viewed, updated and safely archived/deleted only when unreferenced.
- Duplicate, invalid and cross-organization references are rejected.
- Timetable conflict behavior is covered by tests and a practical workflow.

### H. Teacher timetable — P1, required where timetable feature is exposed
Required:
- Keep assignment references valid.
- Detect overlapping teacher/time/section or room constraints supported by the current product.
- Move business logic out of direct route-level model operations into the established service/repository boundary.
- Prevent edits/deletions that would invalidate timetable entries.

Acceptance:
- Conflicting and non-conflicting scenarios tested.
- Assignment update/delete behavior with existing timetable entries is explicit and safe.
- API errors are consistent and actionable.

### I. Authorization, data isolation and audit trail — P0, production-critical
Required:
- Apply authentication and role permissions to every read/write action.
- Enforce organization and campus scoping server-side, not only in UI.
- Validate all foreign references against the active tenant.
- Record who performed sensitive academic-year activation, archive, placement and assignment changes where audit logging exists/ is required.
- Avoid exposing student/teacher records to unauthorized roles.

Acceptance:
- Role matrix tests cover admin, academic staff, teacher and read-only roles as applicable.
- Cross-tenant/campus ID substitution is rejected.
- Direct API calls cannot bypass UI restrictions.
- Sensitive state changes have traceable actor/time where supported.

### J. UI/UX and accessibility — P1
Required:
- Clear navigation and consistent list/form/detail patterns.
- Loading, empty, success, validation and server-error states.
- Confirm destructive/archive actions and explain dependency blocks.
- Search/filter/sort/pagination for lists where record counts require them.
- Responsive layouts for common desktop/tablet/mobile widths.
- Accessible labels, keyboard operation and visible focus.

Acceptance:
- Core workflows complete without developer tools.
- No clipped controls or unusable tables at mobile width.
- Form errors identify the field and how to correct it.

### K. API and database integrity — P0
Required:
- Consistent validation, response/error contracts and status codes.
- Unique indexes match the intended organization/campus scope.
- Database constraints/transactions protect single-active-year and other race-sensitive invariants where feasible.
- Referential checks use actual model fields and are covered by repository/service tests.
- Avoid destructive cascades that erase operational history.

Acceptance:
- Unit/service/repository/route tests pass.
- TypeScript checks and production builds pass.
- Duplicate and concurrent-write cases are exercised where applicable.
- No secrets or production database data appear in test logs.

### L. Documentation — P1
Required:
- Maintain this requirements baseline and link implementation/test evidence.
- Document active-year policy, term overlap policy, role permissions, placement/promotion history, archive/delete behavior and setup steps.
- Update production runbook only for verified operational behavior.

Acceptance:
- A school operator can understand the purpose and safe use of each academic setup area.
- Developers can identify API/model ownership and verification commands.
- Documentation does not label untested functionality as complete.

### M. SEO — P2 / public-site only
Decision:
- Authenticated Academic Setup pages should remain private and non-indexable.
- Public marketing/institute website pages may need title, description, social metadata, canonical URLs, sitemap and robots review.
- Do not add SEO metadata to private dashboard routes as a substitute for access control.

Acceptance:
- Private routes require authentication and are not exposed through public sitemap.
- Public pages have appropriate metadata if/when they are in the public website scope.

## 4. Verification plan required before any PASS

Use a dedicated staging/test database only. Confirm environment identity without printing credentials; take a backup or use a disposable database before seeding. Never insert synthetic records into a production institute.

Synthetic dataset proposal:
- Institute: Al-Noor School & College (test tenant only)
- Academic year: 2026–2027
- Terms: Term 1, Term 2, Term 3
- Classes: Nursery, Class 1, Class 5, Class 9
- Sections: Class 5-A and Class 5-B
- Subjects: English, Mathematics, Science
- 20–30 clearly labelled dummy students and 5–8 dummy teachers
- Link students, guardians, placements and teachers only with synthetic test identities.

For each feature verify:
1. Create and read/list/detail.
2. Update.
3. Archive/delete and dependency behavior.
4. Relationships to dependent modules.
5. Validation, duplicates, invalid references and date boundaries.
6. Organization/campus and role permissions.
7. Persistence after refresh and re-login.
8. Automated tests plus real UI/API/database workflow evidence.

Status vocabulary:
- **PASS:** automated checks and practical workflow both verified with evidence.
- **FAIL:** reproducible defect exists; fix and retest.
- **PARTIAL:** some acceptance criteria pass, others do not.
- **NOT TESTED:** no sufficient evidence.
- **DEFERRED:** explicitly outside current release.

## 5. Step 3 implementation order

1. Fix the existing academic test scope failure and restore clean API typecheck.
2. Confirm tenant/campus model and finalize active academic year policy.
3. Complete Academic Year and Term validation/lifecycle.
4. Complete Classes and Sections, including ordering and capacity policy.
5. Complete Subjects and class applicability.
6. Complete student placement/history.
7. Complete teacher assignments and timetable integrity.
8. Complete permissions, reference protection and UI states.
9. Add/update documentation and automated tests.
10. Seed synthetic staging data and run end-to-end practical verification.

## 6. Product policy decisions — research-backed baseline (2026-10-30)

These are the default release decisions based on the current InstituteOS organization/campus model and review of established SIS/calendar workflows. A pilot institute may request a documented exception, but exceptions must not silently weaken data integrity.

1. **Active Academic Year: organization-wide for the current release.** One active year per organization is the default because the current AcademicYear model is organization-scoped and most school campuses under one owner are expected to share a session calendar. This keeps setup simple and avoids duplicating the same year for every campus. Campus-specific calendars are a future extension only if a real pilot proves that campuses run independent calendars; do not add campusId to the year model without a migration and cross-module impact plan.
2. **Term overlap: blocked by default.** Terms within the same academic year must not overlap. A special exception may be allowed only through an explicit privileged action with a mandatory reason, actor/time audit record and tests. Do not permit accidental overlap through ordinary create/update forms. A one-off special program can be represented separately if that better fits its dates and reporting.
3. **Section capacity: optional, enforced when configured.** If capacity is blank, no capacity limit is applied. If set, count active placements only and reject a new placement that would exceed capacity. Updates/transfers must not double-count the same student. Waitlists are deferred.
4. **Departments: controlled category for this release.** Keep the current subject.department field, normalize/validate labels and offer consistent choices. Do not build a separate Department entity until a pilot requires department-level ownership, staff membership, budgets or reporting.
5. **Activate/archive authority: Organization Owner and Organization Admin only.** Campus Admin, Principal/Director and Academic Coordinator may manage ordinary academic records only where their role permissions allow; they cannot activate or archive the organization-wide academic year. The Owner remains the highest authority. Enforce this in API authorization, not only by hiding UI controls.
6. **Student promotion: close old placement and create a new placement.** Preserve the old year/class/section and its attendance, fees and exam history. Create a new placement for the next year, with explicit outcomes such as promoted, retained, transferred or graduated where the current product supports them. Never overwrite the prior placement to represent a new year.

### Research notes informing the baseline
- PowerSchool documents that academic terms can overlap, demonstrating that overlap is a valid special scheduling pattern in some institutions; Blackbaud scheduling guidance warns that overlap can cause scheduling errors, supporting a strict default with controlled exceptions.
- openSIS stores enrollment information and historical enrollment, including exit and rollover details; this supports retaining year-by-year placement history rather than overwriting it.
- Registrar guidance from Nebraska/Kansas State describes section enrollment caps and actual enrollment counts, supporting optional configured capacity with clear enforcement.
- SchoolDay and Schoolyi role references separate high-impact organization-level settings/academic-year activation from ordinary staff permissions, supporting owner/admin-only lifecycle controls.

**Step 2 policy baseline is frozen for implementation.** Any pilot-specific exception must be documented before it is enabled. Step 3 is authorized to proceed; this document remains a requirements baseline, not proof that the features are implemented or tested.

## 7. Step 3 implementation progress — 2026-10-30 (not a release sign-off)

### Implemented in source; automated checks currently passing
- Academic-year lifecycle routes enforce Organization Owner / Organization Admin authority for status transitions and deletion.
- New academic years default to archived in both service and Mongoose schema.
- A partial unique MongoDB index declares one active academic year per organization; academic models are initialized during database startup so declared indexes are built before readiness is reported.
- Term create/update checks reject date overlap within the same academic year; referenced terms are protected from deletion.
- Section placement checks configured capacity using active placements and excludes the same student when counting an update.
- Reference protection has been expanded for academic years, terms, classes, sections, subjects and teacher assignments across the dependent modules currently identified.
- Added targeted tests for year defaults/index definition, section capacity validation, term overlap, placement capacity, and database model initialization.

### Verification evidence recorded
- Academic + attendance + database connection targeted tests: 41 passed.
- Full API test suite: 171 passed in the latest complete run before the final database-index/startup edits; rerun required after those edits.
- API/Web TypeScript checks and API production build were previously successful before the latest database startup edits; rerun required after those edits.
- API lint passed after removing an unused import in the academic repository test.
- git diff --check was included in the latest verification command; final exit status must be confirmed.

### Still NOT COMPLETE / NOT VERIFIED
- No live staging database has been positively identified or seeded. No synthetic tenant, student, guardian or teacher data has been inserted.
- No browser-to-API-to-database end-to-end run or persistence-after-relogin evidence exists.
- Section capacity is checked in the service but is not yet race-safe under simultaneous placement requests; a transaction/atomic capacity reservation design and concurrent test remain required.
- Active-year uniqueness is database-enforced once the index exists, but a one-step atomic switch workflow (archive current + activate next) and migration handling for any pre-existing duplicate active years remain outstanding.
- Class display ordering is not implemented.
- Subject-to-class applicability is not implemented/enforced.
- Student promotion outcome workflow (promoted/retained/transferred/graduated) and historical old-placement closure/new-placement creation have not been verified end-to-end.
- Teacher timetable CRUD still contains direct model operations in the route layer; service/repository refactor and full teacher/section/room conflict rules remain outstanding.
- Role/campus/tenant substitution tests for all academic routes and UI responsive/accessibility acceptance remain outstanding.

**Release status: PARTIAL.** No academic feature may be described to a school as production-complete until the outstanding items are implemented and the synthetic staging E2E acceptance suite passes. Existing uncommitted work remains preserved.


### Final automated verification refresh — 2026-10-30
- Full API suite after database model initialization changes: 174 tests passed across 26 files (exit code 0).
- Full Web suite: 87 tests passed across 13 files (exit code 0).
- Targeted Academic/Attendance/DB tests: 41 passed across 6 files.
- API lint, API typecheck, Web typecheck, API production build and git diff whitespace check completed with exit code 0 in the same verification sequence.
- These are automated test/build results only. They do not replace live staging MongoDB index creation, synthetic data workflows, concurrency tests or browser/API/database E2E evidence.

## 8 Academic UI implementation update — 2026-10-30

### Added in the current implementation pass
- Added a dedicated Academic Overview screen with live totals for academic years, terms, classes, sections, subjects, teacher assignments and campuses.
- Added navigation between Overview, Academic Years, Terms, Classes & Sections, Subjects, Teacher Assignments and Timetable.
- Added a teacher-wise weekly timetable UI using the existing authenticated timetable endpoints. It supports creating, editing and removing timetable entries, displays assignment context, and surfaces API conflict errors.
- Added responsive styles for the overview metric cards and timetable forms/list.
- Added `AcademicOverview.test.tsx` covering active-session summary, metrics and setup navigation.

### Verification from this pass
- Web TypeScript check: PASS.
- Web test suite: 14 files, 89 tests passed.
- Web production build: PASS.
- `git diff --check`: PASS (Git emitted only line-ending normalization warnings).

### Still PARTIAL / NOT TESTED
- The current timetable API conflict check is teacher-time focused; section and room collision policies still need implementation and tests.
- Student promotion outcomes and old-placement closure/new-placement creation are not yet available as a complete UI/API workflow.
- Subject-to-class applicability mapping and enforcement are not yet implemented.
- Class display ordering is still missing.
- Active-year switching still needs a safe atomic transition and existing-data index migration plan.
- Section capacity remains a read-then-write check and is not proven safe under concurrent requests.
- No browser-to-database E2E, staging seed, refresh/re-login persistence or real authorization matrix has been run. MongoDB remains intentionally untouched while its service is stopped.

**Release status: PARTIAL — do not advertise the Academic module as production-complete yet.**

## 9 Session-loading diagnosis and Academic UX review — 2026-10-30

### Session loading root cause
- Vite web server responds HTTP 200 on `127.0.0.1:5173`.
- API process listens on `127.0.0.1:4000`; Vite proxy points to `API_PORT` default 4000. No port mismatch found.
- API readiness endpoint `/api/v1/ready` returns HTTP 503 and reports database disconnected.
- Windows MongoDB service is installed, Automatic startup, but currently Stopped.
- TCP port 27017 has no listener.
- Starting MongoDB from the connected non-elevated shell failed because the Windows account is not Administrator. An elevated start request was launched; the service remained Stopped during this check. No database files or service configuration were changed.
- `AuthProvider` previously retried every transient session error indefinitely, which can keep ProtectedRoute on "Checking your session…" while API/database recovery never succeeds.
- Changed session bootstrap to make at most two retries, then show the existing error/retry UI. Updated the error copy to explain checking API and database services.
- The database outage remains the infrastructure blocker; session UI no longer intentionally spins forever.

### Academic UX requirement comparison
- Overview: present as a dedicated screen with institute-level metric cards and setup shortcuts.
- Academic Years and Terms: separate navigation destinations exist.
- Classes & Sections: present as a separate destination with class cards and an in-panel class detail drawer.
- Class Detail is only PARTIAL versus the approved workflow: current drawer has Sections and Teachers & Subjects tabs, plus student management / teacher assignment actions. It does not yet provide the full dedicated Students, Teachers, Subjects and Timetable tabs within a specific class.
- Subjects: separate catalogue destination exists; subject-to-class applicability mapping is not present.
- Timetable: separate destination and teacher-wise weekly UI added; backend conflict rules still incomplete.
- Student Promotion: complete workflow is not present.
- Therefore the approved UI structure is PARTIALLY implemented, not identical/complete yet.

### Current verification
- Web typecheck passed after bounded retry change.
- Full Web test suite was still running at the time of this note; final result must be captured before release status is updated.
- Live database/E2E verification remains blocked until MongoDB service starts and API readiness becomes healthy.
