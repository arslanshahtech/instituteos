# InstituteOS Competitor Gap Audit

**Audit date:** 2026-10-28  
**Scope:** Web application and API only. React Native apps and a differentiating feature are intentionally deferred to the next phase.  
**Repository:** `D:\Projects\InstituteOS` · branch `ui/final-prototype-design`

## 1. Evidence rules

This audit separates three kinds of evidence:

- **Code evidence:** a relevant UI/API/model exists in the repository.
- **Automated test evidence:** unit/component tests cover some behaviour. This does not prove the full live browser/database workflow is production-ready.
- **Live acceptance evidence:** a workflow was completed against a staging database in a browser, including permissions, persisted data, print/export output and recovery behaviour.

A module must not be advertised as “production-ready” merely because its navigation item, screen, or API route exists.

### Follow-up code audit and result-publication implementation (2026-10-28)

The exam result model and repository already contained publication metadata and persistence, but the admin service/route/UI and the parent portal response were not wired end-to-end. The current code change adds that missing vertical slice:

- `PATCH /api/v1/organizations/:organizationId/examinations/:examId/results-publication` is protected by the existing exam-management role, `examination.write` permission and CSRF middleware.
- Publishing is rejected unless the exam has schedules and every scheduled class/section has an exam mark for every currently enrolled student. Published exams must be unpublished before exam, schedule or mark changes are allowed.
- The exam workspace shows draft/published status and a confirmation-based publish/unpublish action for school-management roles.
- The parent/student portal response now includes marks only for published exams whose organization, academic-year placement, campus, class and section match that linked student. The parent results screen displays subject, exam, date, marks, grade/percentage and absence state. Draft marks remain hidden.
- The service tests cover missing marks, complete publication and preventing mark edits after publication. This is automated code-level evidence; authenticated browser testing, database-backed portal testing and a real staging smoke run are still release gates.

Latest local verification for this code revision passed: lint, typecheck, full automated suites (149 API tests and 76 web tests), production build, and Prettier formatting check. These are code-level checks, not a substitute for the staging acceptance tests above.

The previously listed high-priority gaps remain: spreadsheet import with preview/row-level validation; one family payment allocated across multiple children/months; dedicated 58mm/80mm receipt layouts; daily cashier reconciliation and month-wise defaulter aging; student document upload/access controls; and operational backup/restore proof. These should be implemented and accepted as complete workflows, not represented as finished just because a screen or data field exists.

### Competitor evidence limitation and live Ilham snapshot (2026-10-29)

Ilham 360's authenticated School Admin portal was opened in the connected desktop and the following screens were visually inspected in a read-only manner on 2026-10-29:

- **Dashboard (`/school-admin`):** visible student/staff attendance summary, monthly fee collection/invoice summary, exam status/summary, enrolment gender breakdown, left navigation and trial indicator. The banner explicitly stated that students, families, fees and results were sample data.
- **Students (`/school-admin/students`):** visible student count/list, search and class/status/age filters, ID cards, leavers, student photos, measurements, add-student control, admission/family numbers, guardian/contact, status, and view/edit/delete controls. No record was added, edited or deleted.
- **Mark Attendance (`/school-admin/attendance/mark`):** visible date, class and section selectors and Present/Absent/Leave/Late counts. No attendance was saved.
- **Invoices (`/school-admin/fees/invoices`):** October 2026 showed 96 invoices; Rs 312,000 billed, Rs 164,050 paid, Rs 147,950 still owed/overdue, and 50 overdue invoices. September showed 96 invoices and Rs 49,150 owed. Visible filters included All, Still owed, Overdue, Part paid, Paid and Voided; class/search filters plus Excel, Print challans, Update overdue and Make invoices controls. No action was executed.
- **Exams (`/school-admin/exams`):** one First Term Examination card showed 10–18 September 2026, Published, Step 5 of 5, 96 results across 6 classes and a View results action. Results were not opened or modified.
- **Student import plan gate (`/school-admin/students/import`):** a visible notice said student import is available in Pro and Campus only; current plan does not include it. This is a plan-gating observation, not an import workflow test. No file was uploaded and no upgrade action was taken.

A guessed `/school-admin/finance` route returned 404; the actual invoice list route above loaded correctly. Attempting a sample invoice-detail URL returned to the invoice list, so invoice detail/payslip-style receipt output was not verified. No import, receipt, exam publication, payment, destructive action or other save action was performed in this live snapshot.

These screens verify visible UI and plan gating only, not persistence, permissions, backend behavior or complete workflows. Ilham 360's manual, pricing page and Excel-import guide remain **publicly documented vendor claims** unless explicitly listed above as visually observed. Any production-readiness claim requires separate end-to-end acceptance testing.

EDUBase was inspected in a previous authenticated demo session. Some screens and one reversible class create/delete workflow were exercised, but the entire advertised module set was not tested end-to-end.

### Day 1 scope freeze and verification baseline (2026-10-29)

The initial Day 1 repo review found 133 changed or untracked Git status entries. These pre-existing edits were preserved; no reset, commit or push was performed. Three temporary screenshots created for the Ilham visual audit were removed after their observations were recorded. Other existing scratch scripts/logs were left untouched.

Verification on this working tree:

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- API tests — 25 files, 149 tests passed.
- Web tests — the first monorepo run had one transient `src/app.test.tsx` failure because the foundations route remained on the `Loading page…` suspense fallback; the exact test passed when isolated, and a subsequent standalone web run passed all 11 files and 76 tests. Keep lazy-route loading under observation rather than dismissing the initial failure.
- `npm run build` — passed. Vite emitted non-blocking third-party Zod annotation warnings.
- `npm run format:check` — passed.

This is a local code/test baseline only. No production deploy, real-school data migration, staging browser acceptance, backup restore or payment provider flow was performed as part of Day 1.

## 2. Competitor capability summary

### Ilham 360 — publicly documented claims

Ilham 360 presents a focused school-management workflow across School Admin, Accountant, Teacher and Parent portals. Its public manual describes student and family records, classes/sections, teacher records, attendance, exams/results, monthly fees, parent/teacher access, notices and reporting. Its guides put particular emphasis on school-office migration and fee collection. Sources: [Ilham 360 manual](https://www.ilham360.com/manual), [Excel import guide](https://www.ilham360.com/guides/import-students-from-excel), [pricing](https://www.ilham360.com/pricing).

The current public manual and guides additionally describe monthly invoice generation that skips already-existing invoices, three-copy A4 challans (student/bank/school), partial payments with payment method/reference/received-by details, configurable 58mm/80mm thermal receipts, result cards for published exams, student-promotion mappings, attendance mark-all/report export, and overdue-aging buckets. These are documented vendor claims and are not evidence that each flow was verified in the authenticated portal during this session. Sources: [manual](https://www.ilham360.com/manual), [Excel import guide](https://www.ilham360.com/guides/import-students-from-excel), [pricing](https://www.ilham360.com/pricing).

The notable differentiators to validate against our implementation are:

1. **Excel migration with preview:** match existing register headings, show valid/warning/error rows before writing, preserve Urdu names, explain bad cells, handle imperfect school registers, and report created/skipped/error counts.
2. **Family-level fee handling:** siblings under one family, old dues visible by month, partial payments, oldest-due-first allocation, and a receipt spanning several invoices/children.
3. **Daily collection reconciliation:** totals by payment method and a day-wise collection/defaulter view with clear overdue-aging buckets.
4. **Print-ready outputs:** three-copy A4 challans/reports plus configurable 58mm/80mm thermal payment receipts.
5. **Result publication and academic-year promotion:** draft/submit/publish results, print result cards, map promotions deliberately, and make irreversible actions explicit.
6. **Simple role separation:** Accountant access without unrestricted school administration; parent/teacher access scoped to their actual children/classes.
7. **Data portability and migration assistance:** complete export and onboarding help are part of the vendor's public positioning.

The public pricing page and home/manual copy do not always show the same Pro student limit. Pricing claims should be treated as a commercial reference, not evidence of software reliability.

### EDUBase — observed demo capabilities and public positioning

The earlier authenticated demo exposed a broader school-operations menu: admissions/student directory, fee challans/payments, attendance, exams/results, staff/HR/payroll, accounting/finance, notices/messages, timetable, LMS/lesson planning, inventory/assets, library, transport, hostel, canteen/POS, front desk/gate workflows, reports, roles/logging and several attendance-device integrations. Its current public feature book advertises 30 modules / 12 departments, AI assistance, mobile apps, face/QR/biometric/geolocation attendance, bank collections, double-entry accounting and HR/payroll. These are vendor claims unless a specific workflow was exercised. Source: [EDUBase feature book](https://www.edubaseems.com/feature-book/).

During the earlier live demo audit:

- Attendance filters, status controls and save/report/export actions were visible; no attendance was saved and no messages were sent.
- Salary approval/pay screens and employee-management controls were visible; no salary was paid or approved.
- A temporary test class was created, verified after reload, deleted and confirmed absent.
- Some routes were slow or left on loading states during sampling.
- Certain assistant functions returned permission errors for the tested account; that does not prove the whole assistant was broken.

## 3. InstituteOS code-coverage matrix

Status labels:

- **Present in code:** relevant repository modules/components exist.
- **Partly covered:** important pieces exist but competitor-level workflow or evidence is incomplete.
- **Gap / not evidenced:** no sufficient implementation or acceptance evidence surfaced in this audit.
- **Needs staging test:** must be proven with a real browser and production-like database before launch.

| Area                                                                          | Repository evidence                                                                                                                                                                    | Current audit conclusion                                               | What a school gains / next step                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Login, organizations, campuses and roles                                      | API auth, tenant context, permissions and CSRF middleware; tenancy/auth route tests                                                                                                    | **Present in code; needs staging test**                                | Correct role and campus scope protects students' private records. Test cross-school and cross-campus access through the deployed browser, not just unit tests.                                                                                                                                                                                                                                                                                   |
| Admissions, students and guardians                                            | Admission, people/student/guardian UI and API modules; component/service tests                                                                                                         | **Present in code; needs full workflow test**                          | Office can find, create and update records. Validate admission-to-student creation, duplicate handling, family/sibling linking and archive/withdrawal history.                                                                                                                                                                                                                                                                                   |
| Student Excel/CSV migration                                                   | Searches of app source did not surface an XLSX importer or student-import workflow                                                                                                     | **High-priority gap**                                                  | Existing register can be migrated safely instead of retyping hundreds of children. Implement upload → column mapping → validation preview → duplicate review → explicit confirm → import summary. Preserve Urdu text and never silently guess ambiguous dates or gender. For pilot onboarding, do not put migration behind a paid-tier gate; if the importer is not stable yet, provide a supervised one-time import with the school’s approval. |
| Classes, sections, years and promotion                                        | Academics module/API and tests exist                                                                                                                                                   | **Partly covered; promotion needs acceptance evidence**                | Year setup is the basis for fees, timetables and exams. Add explicit promotion mapping, preview affected students, prevent accidental duplicate placements, and archive final-grade students where appropriate.                                                                                                                                                                                                                                  |
| Student attendance                                                            | Attendance API/service/UI and tests exist                                                                                                                                              | **Present in code; needs staging test**                                | Teachers/admins can mark daily attendance and correct mistakes with history. Verify class/date filters, bulk mark, duplicate prevention, audit history, reports and role scope.                                                                                                                                                                                                                                                                  |
| Staff records and HR                                                          | Staff records/routes/pages exist                                                                                                                                                       | **Partly covered; payroll parity not evidenced**                       | School can manage staff information. Salary plans, advances, attendance deductions, payslips and ledger posting need a separate acceptance audit before being presented as complete.                                                                                                                                                                                                                                                             |
| Exams and results                                                             | Examination module and service tests exist                                                                                                                                             | **Partly covered**                                                     | The publication metadata is now wired through a manager-only API, the exam workspace and the linked-student portal. Publishing is blocked until every scheduled roster has marks, and edits require unpublishing first. Database-backed staging and linked-parent authorization checks remain required before production sign-off.                                                                                                               |
| Homework and notices                                                          | Homework routes/models and tests; communications module exists                                                                                                                         | **Present in code; delivery integrations need proof**                  | Teachers can assign work and families can receive relevant notices. Verify attachment upload, target audience, read/seen state, schedule/retry handling and actual delivery provider before promising automatic SMS/WhatsApp.                                                                                                                                                                                                                    |
| Fee invoices and payments                                                     | Finance/fee module, fee-operations UI/API, concessions, payment records and tests; acceptance criteria in `docs/finance-module-acceptance.md`                                          | **Core present; end-to-end money flow needs proof**                    | Office can issue invoices and record payments. Confirm same-cycle duplicate prevention, partial-payment math, transaction safety, accurate outstanding balances and immutable/audited payment history.                                                                                                                                                                                                                                           |
| Family/sibling fees and arrears                                               | Concessions include sibling discount type; no sufficient evidence of one family payment allocated oldest-first across children/months                                                  | **High-priority gap to verify/implement**                              | Families often pay several months or siblings at once. Show dues month-by-month and let one payment be allocated across selected outstanding invoices with a clear allocation preview and one traceable receipt.                                                                                                                                                                                                                                 |
| Printed receipt / thermal receipt                                             | Fee acceptance doc requires downloadable/printable receipts, but the parent portal explicitly says receipt download is not exposed; no thermal receipt workflow found in source search | **Gap / acceptance not complete**                                      | Cashier needs reliable paper proof. Implement branded A4 receipt and compact 58mm/80mm print layout; verify print scaling, receipt number, paid amount, balance and reprint audit trail.                                                                                                                                                                                                                                                         |
| Collection summary / defaulters                                               | Finance reports and CSV export exist; finance payment records support filters                                                                                                          | **Partly covered**                                                     | Accountant/principal needs daily cash totals and a clear list of overdue balances. Add day-wise totals by cash/bank/online, month-wise arrears, and reconciliation checks against individual payments.                                                                                                                                                                                                                                           |
| General ledger / trial balance / P&L                                          | Finance expenses and budgets exist; code search did not surface chart-of-accounts/journal/trial-balance workflows                                                                      | **Gap versus EDUBase breadth**                                         | These features matter when a school requires full accounting, but should not be simulated with simple expense cards. Defer full double-entry accounting until the fee ledger is correct and audited.                                                                                                                                                                                                                                             |
| Parent portal                                                                 | Responsive web portal pages expose linked-student fees, attendance and messages; published result display is now wired in code and needs staging verification                          | **Partly covered; needs data-scope and output tests**                  | Parents can self-serve basic information. Verify guardian-to-child authorization, siblings, no cross-family data, published-only results and downloadable receipts. Native Parent app is next week's scope.                                                                                                                                                                                                                                      |
| Teacher portal / timetable                                                    | Teacher-oriented routes and homework/timetable pieces exist                                                                                                                            | **Partly covered; timetable setup needs verification**                 | Teacher sees assigned sections, today's timetable, attendance and homework. Verify that teachers cannot mark or view unassigned classes; build the admin timetable editor only if the core schedule model is reliable.                                                                                                                                                                                                                           |
| Reports/export                                                                | Reports dashboard and CSV export exist; CSV formula injection is addressed in frontend export helper                                                                                   | **Present in code; test representative reports**                       | Office can reconcile and keep offline copies. Ensure exports respect active filters, avoid exposing internal IDs, preserve Urdu UTF-8 and match report totals.                                                                                                                                                                                                                                                                                   |
| Document management                                                           | Product contract explicitly calls out missing/unverified document-management workflow                                                                                                  | **Gap**                                                                | Student documents should be access-controlled, downloadable and tied to a record with allowed file types, size limits and audit events. Do not make a nonfunctional “Documents” tab.                                                                                                                                                                                                                                                             |
| Pickup / gate-pass                                                            | Pickup module/API and service tests exist                                                                                                                                              | **Present in code; needs operational acceptance test**                 | Helps prevent a child being handed to an unapproved person. Verify expiry, authorization, record history and staff permissions before enabling in a real school.                                                                                                                                                                                                                                                                                 |
| Inventory, transport, hostel, library, POS, front desk, LMS, recruitment      | No complete matching set was evidenced by this source audit                                                                                                                            | **Not in pilot scope unless code audit finds an implemented workflow** | These expand the market but dramatically increase complexity. Do not add empty menu items for parity optics; schedule a separate phase based on pilot demand.                                                                                                                                                                                                                                                                                    |
| AI assistant, SMS/WhatsApp provider, bank payments, biometric/face attendance | Product contract classifies several integrations/AI capabilities as planned or unverified                                                                                              | **Not production-ready until integration + safety tests exist**        | Never claim connected delivery/payment/AI actions without real provider credentials, sandbox tests, permission-scoped data access and human approval for money or external messages.                                                                                                                                                                                                                                                             |
| Audit trail, backup and restore                                               | Audit/tenancy/security foundations exist in repository; deployment runbook defines release gates                                                                                       | **Must be proven operationally**                                       | A real school needs to reconstruct changes and recover from accidental deletion or provider failure. Test logs, scheduled backup, restore and tenant-isolated access in staging.                                                                                                                                                                                                                                                                 |

## 4. Required workflow acceptance tests

These are release gates, not merely visual checks.

### A. Student and family data

- Create a student, link one or two guardians, record family/sibling relationships and then find the student by name, roll/admission number and guardian phone.
- Import a representative anonymised school register, including Urdu names, missing dates, duplicate candidates, unknown columns and siblings.
- Preview must show all changes before writing; import must report accepted, skipped and rejected rows with row-level reasons.
- Export the same dataset again and compare row counts, key values and Urdu text.

### B. Fees and receipts

- Generate invoices for a known class/year; rerun the same cycle and prove there are no duplicates.
- Test unpaid, partial and fully paid invoices. Reject overpayment or require a separate authorised credit/refund workflow.
- Make one family payment for two children and multiple months; verify each allocation, remaining balance, payment method totals and one traceable receipt.
- Reconcile the day-wise cashier total to individual payments and verify printed A4/58mm/80mm receipts.

### C. Attendance, exams and parent portal

- Mark a class in bulk for a selected date; correct one record and verify the audit history and report totals.
- Enter exam marks, save draft, publish, and confirm parents only see explicitly published results.
- Test a parent who has two linked children, plus a parent attempting to request an unrelated child's record. Only linked children must be returned.
- Verify timetable/homework and absence-notice links for the correct class/date.

### D. Release / production

- Run lint, typecheck, full tests, production build and formatting check.
- Use a staging database and non-production accounts; verify secure cookies, CSRF protections, tenant isolation, permissions and health/readiness endpoints.
- Test a backup restore, a fresh-school onboarding, print/PDF output, and mobile-width layouts.
- Confirm secrets are set in the hosting environment, never committed to Git, and a rollback path exists.

## 5. UI structure and design rule

Keep the existing visual system and use one consistent page template rather than copying competitor clutter.

1. **Page header:** clear title, short explanation, one primary action (e.g. “Add student”, “Record payment”).
2. **Summary row:** only 3–4 metrics that answer a daily school question (e.g. present today, outstanding fees, unpaid invoices).
3. **Filter toolbar:** search + common filters; advanced date/method filters inside “More filters”.
4. **Main data view:** table for dense finance/attendance records; cards only where names and contact details benefit from scanning.
5. **Record detail:** tabs/sections for Overview, Academic, Fees, Attendance, Documents and Access—only show a tab after that capability works.
6. **Consistent states:** loading, no records, no search results, permission denied, API error with retry, success confirmation, and destructive-action confirmation.
7. **No fake functionality:** do not show a feature as active if it lacks a tested end-to-end path. Hide it or mark it “Planned” outside daily workflows until ready.
8. **Language and context:** use straightforward labels suitable for less tech-aware school staff; preserve Urdu names and Pakistani fee/date conventions. Keep the UI responsive at phone width, even before native apps begin.

Recommended sidebar groups:

- **Daily operations:** Overview, Admissions, Students & Families
- **Academic:** Classes & Sections, Timetable, Attendance, Exams & Results, Homework
- **Accounts:** Fee Ledger, Create Invoices, Concessions, Expenses/Budgets, Reports
- **People & safety:** Staff, Parent/Teacher Access, Pickup & Gate Pass
- **Administration:** Members & Permissions, Communication, Audit/Activity, Settings

Only add a sidebar item when its essential workflow exists.

## 6. One-week web release sprint

The reasonable one-week goal is **a pilot-ready core for one school**, not guaranteed complete parity with every EDUBase module. EDUBase publicly claims dozens of modules; building, integrating and validating all of those in seven days would risk shipping incomplete finance, security or data workflows.

- **Day 1 — Freeze the scope:** finish route/feature inventory, assign each item Present / Partial / Missing, preserve current changes, establish green test/build baseline.
- **Day 2 — Student migration:** safe spreadsheet/CSV import, mapping/preview/errors, duplicates, guardian/family links and export checks.
- **Day 3 — Fees:** invoice idempotency, partial payments, family arrears/allocation, payment history, printable receipts and cashier reconciliation.
- **Day 4 — Attendance + parent/teacher workflows:** class/date filters, bulk attendance, summaries, role isolation and reliable homework/notices in the supported channels.
- **Day 5 — Exams/results + academic flow:** result draft/publish/print, promotion checks and timetable setup only where the underlying workflow is complete.
- **Day 6 — Product hardening:** role and tenant negative tests, responsive/keyboard checks, API error states, audit events, backup/restore drill, regression tests.
- **Day 7 — Staging and release:** fresh-school onboarding, demo seed data, full acceptance checklist, health checks, production build, hosting variables, smoke tests, rollback and support handoff.

If a critical workflow fails its acceptance test, defer the release instead of calling it production-ready.

## 7. Deferred to next phase

After the web pilot is reliable: learn React Native and build the **Parent app first**, reusing the existing API contracts and role-scoped endpoints; then prioritise Teacher or Organization Admin app based on pilot usage. Research 10–12 competing products and interview actual school staff before selecting a differentiating feature. Generic AI chat is not automatically unique because EDUBase already advertises an AI assistant.

## Sources reviewed

- [Ilham 360 Manual](https://www.ilham360.com/manual)
- [Ilham 360 Excel Import Guide](https://www.ilham360.com/guides/import-students-from-excel)
- [Ilham 360 Pricing](https://www.ilham360.com/pricing)
- [EDUBase 2026 Feature Book](https://www.edubaseems.com/feature-book/)
- Repository documents: `docs/INSTITUTEOS_CONTRACT.md`, `docs/ROLE_PERMISSION_MATRIX.md`, `docs/finance-module-acceptance.md`, `docs/PRODUCTION_READINESS_PLAN.md`
