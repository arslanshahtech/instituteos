# InstituteOS — College Pilot & Competitor-Informed Delivery Plan

**Prepared:** Thursday, 29 October 2026  
**Target handover:** Sunday, 1 November 2026  
**Product:** InstituteOS / SAELYN codebase  
**Audience:** College owner, office/admin staff, teachers, accountant, and project team  
**Status:** Delivery plan only — not a production-readiness certificate.

## 1. Executive decision

We have four calendar days including this evening. The correct goal is **a controlled college pilot / guided handover of a verified core**, not complete parity with every Ilham360 and EDUBase feature. EDUBase publicly advertises a much wider module set than we can safely implement, integrate, test, secure, and support by Sunday. Rushing all of it would put student privacy and fee accuracy at risk.

Sunday handover is conditional on the release gates in Section 7. If hosting, database persistence, login/permissions, fee reconciliation, or recovery cannot be demonstrated, hand over a staging demo and a written gap list—not real student data or a claim that the product is production-ready.

## 2. Competitor research: what to learn, not blindly copy

Evidence source: `docs/COMPETITOR_GAP_AUDIT.md`, last audited 28–29 October 2026. The audit distinguishes public vendor claims, screens visually observed, automated tests, and end-to-end acceptance. A visible menu or vendor claim is not proof of a working workflow.

### Ilham360 — focused school-office workflows

The authenticated read-only snapshot showed dashboard summaries, student/family records, attendance controls, fee invoices and overdue filters, exam publication/results, and Excel import plan-gating. The visible demo data banner identified the data as sample data. No real record was saved or deleted during the inspection. Its public documentation describes import preview, monthly invoices, partial payments, A4 challans, thermal receipts, overdue ageing, reports and promotion workflows; treat these as vendor claims until independently tested.

**Lessons for InstituteOS:** reliable Excel/CSV migration, family/sibling fee handling, partial payments, accurate arrears, daily cashier reconciliation, clear printable receipts/challans, result publication, student promotion, role separation, and data export. Do not copy pricing or assume the competitor's screens prove its reliability.

### EDUBase — broad institute operations

The previous authenticated demo exposed a wider navigation covering admissions, students, fee operations, attendance, exams/results, HR/payroll, accounting, notices/messages, timetable, LMS/lesson planning, inventory/assets, library, transport, hostel, canteen/POS, front desk, reports and integrations. A temporary class create/reload/delete flow was exercised; many other workflows were only seen as UI. Some routes loaded slowly and some assistant actions were permission-denied for the test account. The public feature book's 30 modules/12 departments, AI and biometric/mobile claims remain vendor claims, not verified implementation evidence.

**Lessons for InstituteOS:** broad role-aware coverage is a long-term advantage, but empty menus and untested integrations are not product value. Build modules only when the underlying end-to-end workflow, permissions, data persistence, error states and recovery are verified.

## 3. Product position for the college

Position InstituteOS as a **simple, role-based institute operations system** focused first on reliable student records, academic structure, attendance, fee tracking, exams/results, reports and parent/student access where currently supported. Confirm the college's exact operating model before promising fit.

A college may use programmes/departments, semesters, credit hours, course registrations, GPA/CGPA, transcripts, degree audits and university/board integrations. The current code inventory is school-oriented around academic years, classes/sections and subjects. Do not promise a complete higher-education ERP until programme/semester/course-registration/GPA/transcript requirements have been audited and implemented. Sunday discovery must record which of these the college actually requires.

## 4. Current repository facts and honest status

Current project path: `D:\Projects\InstituteOS`  
Current branch: `feat/student-import-preview`.

The repository has React + TypeScript/Vite frontend, Express + TypeScript API, MongoDB/Mongoose, and modules for authentication/tenancy, organizations, people/students/guardians/admissions, academics, attendance, exams/homework, finance, communication, reporting, settings, audit and pickup workflows. Presence in code does not equal acceptance for a real college.

The current working tree contains uncommitted changes for student import and related tests/docs. Preserve them; do not run `git reset --hard`, `git clean`, blanket checkout, or bulk reformat the entire repository. Inspect diffs and make narrow fixes.

Latest observed verification from 29 October:

- Lint: PASS
- Type-check: PASS
- API tests: 157 passed
- Web tests: 85 passed
- Production build: PASS
- Formatting check: FAIL — Prettier reported 177 files. This is a repository-wide result; identify whether warnings are pre-existing or caused by current changes, then format only intended changed files unless a separately reviewed cleanup is approved.

Student Import files exist and targeted tests pass, but staging/database acceptance remains outstanding. Current importer accepts `.xlsx` and `.csv`, up to 5 MB, 1,000 non-empty rows and 50 columns. It creates basic student profiles only; it does not migrate complete family links, programme/semester placement, fee ledgers, payments, admission/roll numbers, documents or sibling dues. Duplicate checks are not a database-level guarantee against concurrent imports. Never claim full college migration based on this importer alone.

Existing docs to keep in sync:

- `docs/COMPETITOR_GAP_AUDIT.md` — competitor evidence and gap matrix
- `docs/PRODUCTION_READINESS_PLAN.md` — staged product and production gates
- `docs/INSTITUTEOS_CONTRACT.md` — product boundaries and planned features
- `docs/ROLE_PERMISSION_MATRIX.md` — role/data-scope requirements
- `docs/finance-module-acceptance.md` — fee workflow acceptance criteria
- `docs/DEPLOYMENT_RUNBOOK.md` — hosting/database/configuration and smoke checks
- `docs/features/STUDENT_IMPORT.md` — importer scope and limitations
- `PROJECT_STATE.md` — historical snapshot; do not use it as current production sign-off

## 5. Scope freeze for Sunday

### P0 — must prove before any real-data pilot

1. Login, session, logout and account recovery behave correctly in the target environment.
2. One college organization can be configured with the agreed campus, academic structure and roles.
3. Student create/search/view/edit workflow persists after reload; access stays within the organization and authorized campus.
4. Attendance can be marked, saved, reloaded and reported for an agreed class/group/date, if included in the college's operating model.
5. Fee invoice/payment workflow is tested using synthetic records: unpaid, partial and paid cases; outstanding balance and receipt match the ledger; rerunning invoice generation does not create duplicates.
6. Exams/results can be drafted and, where supported, explicitly published; parent/student views show only authorized and published data.
7. Import a small anonymized sample only after preview and row-level outcomes are checked. If import validation or recovery is uncertain, use supervised manual entry for the pilot.
8. Confirm API/frontend environment configuration, database persistence, health/readiness, HTTPS, logs without secrets/PII, and a rollback/restore plan.
9. Run the complete automated suite, build and targeted formatting checks on the final candidate; record exact results.

### P1 — include only if already working and accepted

- Parent/guardian linked-child portal and existing communications workflows.
- Existing reports/CSV exports and print-ready reports/receipts where output is verified.
- Existing student pickup/gate-pass workflow, only if the college actually needs it and the full authorization path is tested.
- College branding, logo, campus details and simple first-run setup.

### Explicitly not promised for Sunday unless separately proven

- Full EDUBase parity: LMS, library, transport, hostel, canteen/POS, inventory, recruitment, complete HR/payroll and double-entry accounting.
- Full university ERP: programme/department/semester enrolment, credit-hour registration, GPA/CGPA engine, transcript generation, degree audit or board/university integrations.
- Complete migration of all historical students, guardians, classes, fees, payments and documents in one click.
- Automated WhatsApp/SMS delivery, online payment gateways, biometrics/face attendance, or a production AI assistant.
- Native React Native apps; the existing plan defers Parent app work to next week.
- Any feature represented only by a menu, mockup, sample data, route, or passing unit test without end-to-end evidence.

## 6. Compressed execution plan (Saturday night deadline)

The original seven-day feature plan is retained as the acceptance checklist, but delivery is compressed into the remaining Thursday–Saturday window. This is a prioritization change, not permission to skip tests. Implement and verify existing core workflows first; only add new family/report features if the relevant data model and authorization paths can be completed and tested safely.

| Original day                    | Compressed slot              | Required outcome                                                                                                                                                                                          |
| ------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Day 1 — scope and baseline      | Thursday night               | Preserve changes, record baseline, inventory routes/data models, create staging and acceptance checklist.                                                                                                 |
| Day 2 — students/families       | Friday first block           | Import preview/commit revalidation, duplicate review, student CRUD, Urdu/Unicode CSV export; guardian/sibling links only after authorization and persistence tests.                                       |
| Day 3 — fee correctness         | Friday second block          | Invoice rerun/idempotency, partial/full payments, ledger reconciliation, history and balances; family-level payment allocation only if safely supported by the current model.                             |
| Day 4 — receipts/reports        | Friday late block / Saturday | Verify existing print receipt and exports; implement payment-method totals, month-wise defaulters or A4 challan only if P0 remains green. Thermal printing is out unless tested on a real target printer. |
| Day 5 — attendance/exams/parent | Saturday first block         | Regression-test attendance, result draft/publish and parent privacy; no new portal scope if it jeopardizes core release gates.                                                                            |
| Day 6 — security/hardening      | Saturday second block        | Tenant/campus/role negative tests, responsive UI, document permissions, secrets, health checks and backup/restore.                                                                                        |
| Day 7 — staging/handoff         | Saturday night               | Deploy candidate, run smoke and reconciliation checks, record PASS/FAIL/NOT TESTED, rehearse rollback, prepare Sunday synthetic-data demo.                                                                |

### Thursday, 29 October — tonight: freeze, inspect, stabilize

- Keep current changes and branch intact; capture `git status`, branch, diff summary and baseline outputs.
- Review student-import changes for security, campus/organization scope, duplicate behaviour, failure handling and documentation accuracy.
- Inspect the exact Prettier warnings; do not mass-reformat 177 files without reviewing the resulting diff.
- Triage the reported dependency/security audit: identify package names, exploitability and safe fixes. Do not blindly run `npm audit fix --force`.
- Review college needs checklist: student counts, academic structure, attendance, fees, exams, roles, migration and deployment access.

**Thursday exit:** agreed Sunday scope; no lost working changes; prioritized blocker list; formatting cause understood.

### Friday, 30 October — core workflow day

- Fix and retest the student-import preview/confirm flow; verify backend revalidation and permission/campus checks.
- Exercise student CRUD/search, academic setup, attendance, exam/result publication and fee operations against a test database/browser.
- For fees, verify invoice idempotency, partial/full payment math, outstanding balance, receipt/ledger consistency and unauthorized access. Do not add complex family-level allocation unless the current data model can support it safely and time remains after P0.
- Test role boundaries: owner/admin, accountant, teacher, and linked parent/student only where these roles are included in the pilot.
- Resolve any data-integrity/security blocker before UI polish.

**Friday exit:** each selected workflow has a named test, expected result, actual result and pass/fail evidence.

### Saturday, 31 October — deploy candidate and rehearse

- Deploy to a staging/production-like environment with a separate test database and secrets configured in the hosting dashboard, not Git.
- Confirm HTTPS, correct API origin/CORS/cookies/CSRF, health/readiness, login/logout, database persistence after reload and browser refresh/deep links.
- Run staging smoke checks and manual role/tenant tests.
- Print/check receipts/reports and inspect phone-width layouts on the available device.
- Perform a backup/restore rehearsal if the hosting/database plan supports it. If restore cannot be proven, real sensitive data stays out of the pilot.
- Prepare demo organization with synthetic data, owner/admin account, quick-start guide, known limitations and rollback instructions.

**Saturday exit:** a repeatable demo and written pass/fail release checklist; critical failures are not hidden.

### Sunday, 1 November — college discovery, demo and controlled handover

1. Start with a 20–30 minute discovery: college type, programmes/departments, semester/year structure, student count, fee cycle, attendance rules, exams/grading, staff roles, current Excel files, internet/devices and data-owner approval.
2. Demonstrate only verified workflows using synthetic/sample records: sign in, create/find a student, attendance, fee invoice/payment/receipt, exam/result, report/export as applicable.
3. Ask the college representative to complete the key tasks themselves; record confusion and acceptance.
4. Show what is live, what is pilot-only, what is planned and what data is not yet migrated. Do not call manual WhatsApp links “automated messaging.”
5. If release gates pass, agree a small, authorized pilot and import only the minimum approved data with a verified count and rollback plan. If gates do not pass, provide a staging demonstration and dated remediation plan, not a live-data launch.
6. Handover: named owner/admin, role matrix, quick-start steps, support contact/availability, data export/offboarding approach, known gaps, next review date and written acceptance.

**Sunday exit:** a signed/recorded scope decision, demo outcome, prioritized feedback, and clear pilot/no-go decision.

## 7. Sunday go/no-go checklist

Every item must be marked PASS, FAIL or NOT TESTED; NOT TESTED is not PASS.

- [ ] Final branch/commit and working-tree changes reviewed; no unreviewed or secret files shipped.
- [ ] Lint, type-check, API tests, web tests and production build pass on the exact release candidate.
- [ ] Formatting status explained and intended changed files formatted.
- [ ] Hosted login/logout/session and a safe write/read workflow pass.
- [ ] Database persists data across reload and service restart/deploy test where feasible.
- [ ] Organization/campus/role boundaries tested with negative cases.
- [ ] Fee ledger, invoice, payment, outstanding amount and receipt reconcile for unpaid/partial/paid cases if finance is in scope.
- [ ] Attendance and exam/result permissions/publication are verified if those modules are in scope.
- [ ] Data import has preview, row outcomes, authorization and recovery understood; otherwise import is excluded.
- [ ] HTTPS, secrets, logs, health/readiness and rollback are checked.
- [ ] Backup restore is proven before importing real sensitive data.
- [ ] College-specific academic model is confirmed; unsupported semester/GPA/transcript needs are disclosed.
- [ ] Owner has seen limitations, support expectations, data ownership/export and pilot acceptance terms.

**No-go triggers:** cross-organization data exposure, wrong-campus access, incorrect financial balances/receipts, lost records, broken login/session, unproven data persistence, leaked secrets, or no safe recovery path for real data.

## 8. Full competitor-informed roadmap after Sunday

### Phase A — trustworthy core (immediate)

Student/family records; safe import/export; academic-year/class/section setup; attendance; fee structures/invoices/payments/concessions; printable receipts/challans; exams and explicit result publication; role-based parent/teacher portals; accurate reports; audit trail; onboarding and backup/restore.

### Phase B — finance differentiation

Family/sibling-level dues; payment allocation across children/months; oldest-due-first preview where required; daily cashier reconciliation by payment method; month-wise arrears/ageing; receipt reprint audit; A4 challans and tested 58mm/80mm receipt output; safe payment corrections/refunds rather than deleting history.

### Phase C — college academic model (only after discovery)

Programmes/departments; semester/term setup; course/subject registration; teacher/course allocation; credit hours; grading/GPA/CGPA; transcripts; promotion/semester progression; exam scheduling and result approval; academic calendar. Design the data model before adding screens. Confirm the college's regulations before implementing calculations.

### Phase D — staff and operations

Timetable; HR/staff attendance; payroll and payslips; library; inventory/assets; transport/hostel/canteen/front desk only where customer demand and business case justify them. Full double-entry accounting requires a real chart of accounts, journals, trial balance and reconciliation—not just expense cards.

### Phase E — secure communication and mobile

Official SMS/WhatsApp provider with consent, delivery status, opt-out and cost controls; payment gateway with idempotent webhooks and reconciliation; parent mobile app first (planned next week), then teacher app based on pilot needs; accessibility, Urdu/English and low-bandwidth usability.

### Phase F — AI and SaaS operations

Permission-scoped assistant using approved read-only actions first, no unrestricted database access, no unapproved financial or messaging actions, and auditable answers. SaaS tenant onboarding, subscription billing, support/incident workflow, monitoring, data export/offboarding, security review and repeatable releases.

## 9. Product rules that prevent false completion

1. Status each workflow as **Implemented**, **Automated-tested**, **Staging-accepted**, or **Production-accepted**. Do not merge these into one “complete” label.
2. A module is accepted only after a real role can complete its main path, data persists, invalid actions are rejected, errors are understandable, output/report matches source data, and the relevant tests pass.
3. Preserve tenant and campus scope in every API query and mutation. Never trust frontend-only permission checks.
4. Financial records require auditability, idempotency and reconciliation. Avoid destructive delete as a substitute for corrections/refunds.
5. Keep student/guardian data private; use synthetic data for demos; obtain explicit authorization before migrating real records.
6. Never claim vendor parity based on menu count. Compete on reliable outcomes, assisted migration, simple Urdu/English workflows, fee accuracy, training and responsive support.
7. Keep documentation current. Update `docs/COMPETITOR_GAP_AUDIT.md`, `docs/PRODUCTION_READINESS_PLAN.md`, `docs/INSTITUTEOS_CONTRACT.md`, `docs/ROLE_PERMISSION_MATRIX.md`, and this plan when scope/status changes.

## 10. College owner message

“InstituteOS is being prepared as a role-based system to organize student records, attendance, fee tracking, examinations/results and reports. We would first confirm your college's academic structure and demonstrate the workflows that have been verified. Features such as full semester/GPA management, automated messaging, payment gateways and other specialist modules will only be promised after they are implemented and tested. We propose a controlled pilot with agreed scope, training, data approval and a clear support process.”

## 11. Audit references

- `docs/COMPETITOR_GAP_AUDIT.md`
- `docs/PRODUCTION_READINESS_PLAN.md`
- `docs/INSTITUTEOS_CONTRACT.md`
- `docs/ROLE_PERMISSION_MATRIX.md`
- `docs/finance-module-acceptance.md`
- `docs/DEPLOYMENT_RUNBOOK.md`
- `docs/features/STUDENT_IMPORT.md`
- Ilham360 manual: https://www.ilham360.com/manual
- Ilham360 import guide: https://www.ilham360.com/guides/import-students-from-excel
- Ilham360 pricing: https://www.ilham360.com/pricing
- EDUBase feature book: https://www.edubaseems.com/feature-book/
