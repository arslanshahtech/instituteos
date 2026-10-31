# Academics & Classes UI Implementation Checklist

## Reference and implementation rule

- Visual reference: uploaded InstituteOS Academics Black Minimal prototype.
- Existing InstituteOS API, organization permissions, React Query data loading and existing timetable workflow remain the source of truth.
- Prototype-only sample data and browser-local demo persistence are not copied into production.

## Feature status

| Area                        | Code status                              | Working interactions                                                                                                                                                                      | Notes                                                                                                                                                                                                       |
| --------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Academic Overview           | Implemented                              | Metrics, active-session summary, setup shortcuts                                                                                                                                          | Counts are based on organization API data.                                                                                                                                                                  |
| Academic Years              | Existing API-backed CRUD retained        | Create, edit, delete, activate/archive through status field                                                                                                                               | One active academic year is enforced by the API.                                                                                                                                                            |
| Terms                       | Existing API-backed CRUD retained        | Create, edit, delete                                                                                                                                                                      | Terms remain linked to an academic year.                                                                                                                                                                    |
| Classes                     | Existing API-backed CRUD retained        | Classes overview opens by default; select class to view its details; create, edit, delete, campus filter and search                                                                       | Returning to this tab clears any prior assignment panel state. Class and campus relationships remain API-validated.                                                                                         |
| Sections                    | Existing API-backed CRUD retained        | Create, edit, delete                                                                                                                                                                      | Add Section now preselects the class currently open in the detail panel.                                                                                                                                    |
| Student roster / enrollment | Existing API-backed workflow retained    | View Students opens the current roster; Add Student opens the add/enroll area directly; search and bulk-enroll existing students; create a new student; remove one or multiple placements | Removal is a placement deactivation, not deletion of the student record. Failed placement after student creation now refreshes the eligible list and points to the same record to avoid duplicate creation. |
| Subjects                    | Existing API-backed CRUD retained        | Create, edit, delete                                                                                                                                                                      | Subjects remain organization-scoped.                                                                                                                                                                        |
| Teacher assignments         | Existing API-backed CRUD retained        | Assign Teacher opens its own panel from either class detail tab; Add Subject opens the subject form                                                                                       | Assignment choices use organization-scoped staff, class, section, subject and session records. Missing sections show a create-section step.                                                                 |
| Timetable                   | Existing teacher-first workflow retained | Create, edit, remove, teacher selection, assignment selection                                                                                                                             | API rejects invalid time ranges and overlapping periods for the same teacher. Room-overlap checking is not currently part of this workflow.                                                                 |
| Resource list search        | Implemented                              | Search academic years, terms, subjects and teacher assignments                                                                                                                            | Shows filtered and total record counts.                                                                                                                                                                     |
| Visual styling              | Implemented in code                      | One shared Academics heading; no duplicate Classes & Sections page heading; active tab text and underline black; underline animates subtly on hover                                       | Browser screenshot and responsive click-through still need operator verification.                                                                                                                           |

## Verification evidence

- API tests: 174 passed (26 test files), including academic assignment validation, student placement/removal, campus scope, tenant isolation and referential-integrity safeguards.
- Web tests: 100 passed across 15 test files, including direct Add Student navigation and partial student-creation/placement failure recovery.
- TypeScript typecheck: passed for API and web workspaces.
- Production build: web TypeScript checks and Vite production build passed. Vite emitted dependency annotation warnings from Zod; no build failure. API tests passed; no API source changes were made in this UI round.
- ESLint: passed.
- Git diff check: passed; Git emitted normal LF/CRLF working-copy notices.
- Browser visual/responsive click-through has not yet been performed; automated tests do not replace that acceptance step.

## Final acceptance still required

- [ ] Refresh the running InstituteOS app and inspect the Academics Overview and Classes & Sections heading/navigation.
- [ ] Confirm Classes & Sections always opens its overview after leaving and returning from other tabs.
- [x] Automated: select a class and open View Students, Add Student and Assign Teacher; switch between views repeatedly.
- [x] Automated: recover when a newly created student profile cannot be placed into a section; refresh and filter the same student rather than encouraging a duplicate profile.
- [ ] Test every tab and every create/edit/delete action using a test organization.
- [ ] Confirm class, section, teacher and subject changes persist after refresh.
- [ ] Confirm existing student records appear in the eligible list/roster and remain unchanged after removing a section placement.
- [ ] In a staging-only test, simulate placement failure after creating a student and confirm the same student appears in the eligible list for recovery.
- [ ] Confirm timetable overlap is rejected for the same teacher and day.
- [ ] Check desktop and phone-width layouts.
- [ ] Use synthetic records only until the college approves real-data pilot access.

## Deliberate boundaries

- No full university semester/course-registration/GPA/transcript engine is implied by this school-oriented academic setup.
- No timetable room-conflict guarantee is claimed.
- Automated test success is not the same as staging or production acceptance.
