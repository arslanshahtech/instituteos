# InstituteOS — Real-School Production Readiness Plan

**Prepared:** 24 October 2026  
**Target market:** Independent schools, academies and colleges in Okara/Punjab, Pakistan  
**Status:** Planning baseline, not a declaration of production readiness  
**Delivery model:** Four gated phases; one phase is accepted before the next begins

## Executive decision

InstituteOS is a substantial full-stack school-operations product, not just a portfolio mock-up. The repository contains a React/TypeScript/Vite web app, an Express/TypeScript API, MongoDB/Mongoose models and tested modules for identity, organizations/campuses, students/guardians, admissions, academics, attendance, examinations/homework, fee operations/concessions, communication, reporting, settings and pickup workflows.

**Decision today: not yet ready for an unsupervised real-school rollout.** It is ready for a controlled technical pilot after Phase 1's release blockers are closed. Passing tests and building a bundle demonstrate code-level progress; they do not prove that production hosting, backups, school data import, real staff workflows, support and recovery have been validated.

## Fresh audit evidence (24 Oct 2026)

| Check                     | Observed result                                                                                                       | Meaning                                                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| API + frontend typecheck  | PASS                                                                                                                  | No TypeScript errors in the tested workspaces                                                                           |
| Automated tests           | PASS — 146 API + 76 web = 222                                                                                         | Existing automated checks pass; live database and school UAT are separate gates                                         |
| Production build          | PASS                                                                                                                  | Build completes, but Vite warns that the main JS chunk is about 1 MB                                                    |
| ESLint                    | PASS after cleanup                                                                                                    | One unused invoice-discount handler in the finance dashboard; removed as dead, uncalled frontend code during this phase |
| Prettier check            | PASS after cleanup                                                                                                    | Repository formatting cleanup completed; format:check included in CI                                                    |
| GitHub Actions CI         | Added; hosted run pending                                                                                             | Added .github/workflows/ci.yml for PR/push quality checks (lint, typecheck, tests, build)                               |
| Environment secrets       | .env is ignored/untracked                                                                                             | Keep this true; only placeholder keys belong in .env.example                                                            |
| Deployment/hosting        | Runbook and SPA rewrite added; no live service or domain provisioned                                                  | Hosting, domain, TLS, environment, database, monitoring and recovery still require explicit setup and verification      |
| Hidden prototype artifact | apps/web/src/pages/organizations/Instituteos-Final-Hidden-Access.html is unreferenced and not in the built web bundle | Removed with user confirmation because it was a temporary design reference, not a runtime dependency                    |
| Product documentation     | Historical status labelled; runtime acceptance still pending                                                          | Reconcile documentation with code and acceptance tests before selling features as available                             |

### Known limits of this audit

This was a source-code and local automated-check audit. It did **not** connect to the production MongoDB, run a backup/restore exercise, perform a penetration test, verify the live deployment, measure real school internet/device conditions, or complete UAT with an Okara school. No customer, payment gateway, official WhatsApp sender, SMS provider, production domain or support SLA has been verified.

## Product direction for Okara/Punjab

Do not try to sell every module to every school on day one. The first paying customer should feel the daily difference in three jobs:

1. **Fee control:** who paid, who is overdue, concession/scholarship approvals, correct receipt, and a month-end fee report the owner trusts.
2. **Attendance and parent follow-up:** teachers can finish class attendance quickly on an ordinary phone; staff can identify absentees and initiate a clear WhatsApp follow-up.
3. **Student records and results:** one searchable record instead of repeatedly checking registers and spreadsheets; exam results and printable reports can be shared without complex setup.

Owners pay more for reliable outcomes, migration of their existing records, staff training, quick Urdu/English support, clean reports, data safety and less fee leakage—not because the software has more menu items. Keep the interface simple and hide complexity until a role actually needs it.

Punjab already has an official PEPRIS route for private-school registration and e-licensing. InstituteOS should complement school operations; it must not claim to replace registration, e-licensing, board systems or government reporting unless a supported integration is actually built and verified. [PITB/PEPRIS overview](https://www.pitb.gov.pk/pepris)

## Phase 1 — Release foundation and blockers

**Goal:** Make changes repeatably testable and make a safe deployment technically possible.

### Work items

- [x] Remove the unused frontend invoice-discount handler that caused ESLint to fail. This removes dead, unreachable UI code only; it does not alter the existing concession modal/API rules.
- [x] Add GitHub Actions CI for pull requests, pushes to main and manual runs: locked install, lint, typecheck, tests, production build.
- [ ] Run the new workflow on GitHub and confirm its first hosted run is green.
- [x] Run a formatting-only cleanup across the repository; extend format and format:check to the workflow, smoke script and Vercel config. The check is now enabled in CI; review the formatting diff separately from business-logic changes.
- [x] Remove the design-reference-only Hidden Access HTML from the source tree after the owner confirmed it is no longer needed; verify that the production app does not reference it.
- [x] Reconcile README, PROJECT_STATE, architecture and the product contract: README links to the deployment plan, stale module claims were corrected, and PROJECT_STATE now clearly labels its 14 October matrix as historical rather than current production sign-off.
- [x] Add a deployment runbook for Vercel frontend, Render API, Atlas replica-set, HTTPS domains, environment secrets, CSRF/cookie scope, SMTP, health checks and staging verification. Actual account/DNS/database provisioning remains external.
- [ ] Choose a managed MongoDB replica-set deployment that supports every transaction used by fee, attendance and organization flows. Validate indexes and unique constraints against a staging database.
- [x] Add a read-only `npm run smoke:staging` script for API liveness/readiness, database readiness, CORS and frontend HTML, plus a manual authenticated staging checklist for login/logout, CSRF writes, tenant isolation, receipt reconciliation and restore drills. The script cannot pass until an actual staging deployment is configured.
- [x] Add React.lazy route-level splitting for page modules and a Suspense loading state; verify the resulting production bundle sizes and regression tests before declaring performance accepted.

### Phase 1 acceptance gate

A clean pull request must pass CI; no secrets or real student data are tracked; production environment values are documented; a staging deployment can log in and perform one safe read/write workflow; the app's documentation no longer overstates readiness. A green CI build alone does not pass the whole gate.

## Phase 2 — Okara pilot product: simple, local and useful

**Goal:** Prove that real non-technical school staff can use the daily workflows without depending on the developer for every task.

### Discovery before more feature work

- Interview 5–8 school owners/principals, accountants and teachers from different school sizes in/around Okara. Ask them to show their present fee register, attendance process, monthly report, parent follow-up and Excel/WhatsApp habits. Do not assume all schools work alike.
- Observe staff using their own Android phones, existing laptops and actual internet connection. Record the top five confusing tasks and measure how long they take.
- Select 1–2 pilot schools with written permission, a named school lead and clearly defined trial data. Start with synthetic/sample data; migrate real data only after access, purpose, retention and support expectations are agreed in writing.

### Product work (prioritized)

1. **A short first-run setup:** school name/logo, campus, academic year, classes, fee heads, staff roles and import students. Show a progress checklist and a “Help / WhatsApp support” path.
2. **Urdu + English interface:** a tested language switch, Urdu-readable labels and validation messages, right-to-left layout checks, English and Urdu printable fee vouchers/receipts/results. Keep names and records stored consistently; do not translate user-entered names.
3. **Owner's daily home:** today's attendance completion, fees collected today/month, outstanding dues, recent payments, quick actions and a small number of truthful metrics. Every number must link to the underlying records/report.
4. **Safe Excel/CSV migration:** documented templates, column mapping, preview, duplicate/invalid-row report, student/guardian linkage, rollback or clean retry, and a verified total count before activation.
5. **Fast classroom flows:** select class/date, mark all present, change absentees/late students, save once, show success/failure clearly. Make the common path usable on low-cost Android and small screens.
6. **Finance confidence:** clear due/paid/concession math, approval policy for discounts, sequential receipt references, printable vouchers and filtered Excel/CSV reports. Test partial payments, reversals/corrections and month-end reconciliation before pilot use.
7. **Low-connectivity behaviour:** show when data is stale or a save failed, avoid duplicate submission on retry, keep forms short, and never silently claim a save succeeded. Offline storage of children’s sensitive records is a later design decision, not a default.
8. **Parent communication that is honest:** current WhatsApp links open a prefilled message for a person to send; they are not an automated delivery service. Label this accurately. Automated WhatsApp/SMS alerts require approved provider setup, consent/opt-out rules, delivery status and cost controls.
9. **School-specific terminology and calendar:** validate class names, fee cycles, holidays, academic years, exam grading and report-card expectations against each pilot school's actual process.

### Phase 2 acceptance gate

A trained office user can onboard and import a school's agreed dataset; a teacher can complete one class's attendance in under 3 minutes in the pilot usability test; an accountant can issue a receipt and reconcile it against the invoice/ledger; owner reports match manually verified source totals; no cross-school data is visible; and users can complete the main workflows without developer intervention. These are proposed targets to validate with pilots, not current measured results.

## Phase 3 — Production safety, support and data trust

**Goal:** Protect school records and keep core jobs dependable after real staff depend on them.

### Required engineering and operations

- **Hosting:** separate frontend and API deployments, custom domain/subdomains on a shared registered domain where possible, HTTPS everywhere, correct API CORS, secure session cookies, CSRF and reset links checked from a real browser. Configure the service to bind to the hosting provider's interface/port; the repository's default API host is localhost, which is suitable for development but not a ready-to-use hosted setting.
- **Database:** separate dev, staging and production databases; least-privilege database credentials; network access restricted; transactions and unique indexes verified in the actual deployment. Never copy production student data to dev.
- **Backup and disaster recovery:** automated encrypted backups, a stated retention schedule, access limited to named maintainers, documented recovery-time/recovery-point targets, and a real restore rehearsal at least monthly before expanding the pilot. A backup is not accepted until a restore has been proven.
- **Monitoring:** uptime/readiness checks, error alerts, database connection alerts, deploy rollback instructions, request IDs and privacy-safe logs. Avoid logging passwords, cookies, CSRF/session tokens, OTPs, student data or full fee details.
- **Security:** independent review of authentication/session lifecycle, tenant isolation, campus restrictions, parent-child linking, teacher assignment scope, financial mutation authorization, OTP generation/expiry/throttling, CSRF, rate limiting and object-level access. Add a distributed rate-limit store if multiple API instances are used; the current in-memory limit is not shared across instances.
- **Finance controls:** test transaction consistency and idempotency for payment/receipt creation, invoice generation and discount recalculation; restrict edits to the proper roles; preserve an audit trail; create a correction/refund workflow rather than asking users to falsify old payments.
- **Data ownership and privacy:** written customer agreement, role access, minimum necessary data collection, school data export, account offboarding/deletion procedure, retention rules, incident contact and backup deletion schedule. Ask a Pakistan-qualified lawyer to review contract, children’s information, consent/notice and applicable rules. Do not advertise legal compliance based only on this engineering audit.
- **Notifications/payments:** only enable an official WhatsApp/SMS provider or JazzCash/Easypaisa/bank gateway after merchant onboarding, local costs, consent, idempotent webhooks, failed-delivery handling and reconciliation have been tested. Until then, call these manual links/manual payment recording, not automated integrations.
- **User recovery/support:** account recovery tested end-to-end; school owner can reset/revoke staff access; onboarding and common fixes documented in simple Urdu/English; a named person owns urgent fee/data issues.

### Phase 3 acceptance gate

Complete an independent security review with no unresolved critical/high findings; prove a backup restore; pass end-to-end browser checks in production-like hosting; reconcile fees/receipts and test correction scenarios; document support/incident contacts; and obtain written acceptance from each pilot school's owner. Any critical data-isolation or financial-integrity failure blocks launch.

## Phase 4 — Paid rollout and sustainable service

**Goal:** Turn the successful pilot into a repeatable service, not a one-off installation.

- Define a supportable product boundary. Do not sell the planned AI assistant, full timetable automation, automated messaging, online fee collection, payroll or SaaS subscription billing as available until each has been built and accepted.
- Prepare a school onboarding pack: discovery form, signed agreement, school/campus configuration sheet, import template, verified import report, role training, go-live sign-off and offboarding/export instructions.
- Train one school champion and one backup contact. Provide short screen-recorded tutorials in Urdu/English and a phone/WhatsApp support window that can actually be staffed.
- Publish a simple service promise: support hours, severity response targets, maintenance notice policy, backup/restore expectations and how a school receives its data if it leaves.
- Measure business impact: admin time saved, fee follow-up completion, overdue balance accuracy, import errors, attendance completion, failed saves, support issues and weekly active staff. Do not use vanity metrics as proof of return.
- Keep school fee collection separate from InstituteOS's own subscription billing. Add subscription plans, expiry/grace periods, invoicing, payment reconciliation and cancellation/data export only when the product has a real need for them.
- Introduce paid renewals only after a school has used the product through at least one real fee cycle and one attendance/exam cycle and the owner has reviewed results.

### Pricing hypotheses to validate (not a promise or final price)

Published Pakistani competitors currently show a broad range: Ilham 360 lists PKR 1,500–7,500/month by student capacity; SkoolPro lists PKR 40/student/month for Standard and PKR 55/student/month for Premium; PakEducate lists plans from PKR 1,500/month. These are competitor-published prices, not a guarantee of comparable quality or verified sales. Sources: [Ilham 360](https://www.ilham360.com/pricing), [SkoolPro](https://www.skoolpro.pk/pricing), [PakEducate](https://pakeducate.com/).

Test the value proposition using at least two packages with actual school owners, rather than promising a premium price before proof:

- **Core / single campus:** test PKR 2,500–4,000/month for attendance, fee records/receipts, results and standard reports.
- **Managed / growing school:** test PKR 5,000–9,000/month if it includes assisted data migration, staff onboarding, owner reports and priority human support.
- **Multi-campus / tailored:** quote after discovery for campus consolidation, custom migration, agreed service levels and integrations.
- A one-time migration/training fee can be reasonable when the work is real and agreed in advance; show the fee before starting. Offer a limited, time-boxed pilot, not indefinite unpaid custom development.

These ranges are only experiments for interviews and proposals. Adjust them to student count, school budget, support time, hosting/messaging costs, taxes and demonstrated financial/time savings. Do not charge a school a premium just because there are many modules.

### Phase 4 acceptance gate

At least two schools complete an agreed real operating cycle and renew or provide evidence-based acceptance; agreed service targets are met; support effort and margins are sustainable; school data export/offboarding is tested; and no unresolved critical/high security or financial-integrity issue remains.

## Release checklist (must be checked for every school)

- [ ] Correct school owner, staff roles, assigned campuses and contact channels verified.
- [ ] School has reviewed the import preview and signed off on student counts, fee structures and opening balances.
- [ ] Test data removed; no real student data in demo/staging.
- [ ] Login, logout, password recovery, staff revocation and a role-denied action verified.
- [ ] One real attendance save and one fee receipt/ledger reconciliation verified by school staff.
- [ ] Owner has received and opened the printable receipt/report and can explain how to correct an error.
- [ ] Backup status is visible to the operator and a recent restore drill is documented.
- [ ] Support contact, escalation, maintenance and data-export process given to the school.
- [ ] Owner signs the acceptance and knows the boundary of manual versus automated WhatsApp/payment features.

## Legal and market notes

The Punjab Information Technology Board describes PEPRIS as the official private-school registration and e-licensing route. InstituteOS must not imply it issues or replaces that license: [PITB PEPRIS](https://www.pitb.gov.pk/pepris). Pakistan's data-protection landscape is evolving; a 2026 report describes a draft National Data Governance Policy moving through government processes, while the Senate bill record shows the Personal Data Protection Bill 2023 was disposed of/withdrawn from committee. Treat these as reasons to obtain current legal advice, not as a definitive legal opinion: [Senate bill record](https://senate.gov.pk/en/billsummary.php?bid=1182), [Dawn, 7 Aug 2026](https://www.dawn.com/news/2021159/pakistans-privacy-debate).

## Immediate next actions

1. Run the new GitHub Actions workflow on a push/PR and fix anything that fails.
2. Do a deliberate formatting-only cleanup, review the diff, then add format checking to CI.
3. Schedule customer discovery with 5–8 Okara-area schools before building more modules.
4. Close Phase 1's deployment, secrets, replica-set, backup and smoke-test items before real student data is uploaded.
5. Do not announce “production ready” until the release checklist and phase gates have evidence.
