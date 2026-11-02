# Phase 4 — Parent Workspace

**Scope owner:** InstituteOS
**Status:** In progress
**Scope freeze:** 2 November 2026

## Scope boundary

Implement and verify only the eight agreed Parent Workspace acceptance points. Preserve all existing Owner/Admin and Teacher functionality. Do not introduce online fee payments, React Native apps, unrelated redesigns, or Resend/domain changes in this phase.

## Eight acceptance points

| #   | Acceptance point                                             | Current evidence / status                                                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Parent invitation and account activation                     | Existing organization invitation flow supports the `parent_guardian` role and the shared invitation-acceptance route. Real invitation email delivery is pending the later verified-domain/Resend setup.                                                                             |
| 2   | Verified guardian email linked to the correct child/children | Parent portal now requires an active account with `emailVerifiedAt`, then matches the normalized account email to exactly one guardian record inside the selected organization.                                                                                                     |
| 3   | Parent sees only linked child/children                       | Existing portal resolution uses organization-scoped guardian links plus the legacy guardian ID relationship; only active linked student records are returned. No global student-directory fallback exists.                                                                          |
| 4   | Attendance history and absences                              | Parent API now returns the student's complete attendance history instead of filtering to the current month. Existing UI displays each date, status and remarks.                                                                                                                     |
| 5   | Fee invoices, paid amount and outstanding balance            | Existing portal shows all invoices for each linked child with invoice number, due date, total, paid and outstanding amounts. Online payment is explicitly excluded.                                                                                                                 |
| 6   | Sibling and wrong-linking tests                              | Existing API tests cover multiple siblings, ambiguous guardian email matches and no-link behavior. New test covers rejection before guardian lookup when email is unverified.                                                                                                       |
| 7   | Privacy, permissions and mobile responsiveness               | Portal API is behind authentication, organization-context resolution and parent/student role authorization. Parent UI uses existing responsive layout rules; automated parent-page tests cover child selection, attendance and fee display. Manual viewport review remains pending. |
| 8   | Complete staging Parent workflow verification                | Pending a disposable non-production MongoDB replica set, synthetic parent/guardian/student records and working invitation delivery. No production data or database writes were used.                                                                                                |

## Changes in this execution

- Enforced verified-email state before resolving a parent account to a guardian record.
- Removed the current-month-only attendance filter so the parent can see historical attendance.
- Removed the 12-row truncation from attendance history and fee invoice presentation. The parent API now returns all attendance records and all invoices for each active linked child.
- Updated parent-facing attendance labels and empty state to describe history rather than only the current month.
- Added contextual guidance to the organization member invitation form for the Parent/Guardian role.
- Added API regression coverage for unverified guardian email.
- Added frontend tests for sibling selection, attendance/absence history and invoice totals.

## Verification record

- Full API suite: 232 tests passed across 32 files.
- Full Web suite: 119 tests passed across 18 files, including 3 new Parent Workspace UI tests.
- API and Web typechecks: passed.
- API and Web production builds: passed. Vite emitted only existing dependency annotation warnings from Zod.
- Targeted ESLint and `git diff --check`: passed; Git printed line-ending normalization warnings for the pre-existing dirty working tree.
- Live email invitation, staging persistence and manual 390px / 768px browser review: pending. The local API health endpoint returned 200 and readiness reported a connected database, but the connected database has not been confirmed as a disposable staging database; no live records were read or written.

## Staging acceptance checklis

1. Use a confirmed disposable staging organization and database; create synthetic Guardian, Student A, Student B and an unrelated Student C.
2. Link the guardian to A and B only. Create the parent account with the same email, complete email verification, invite the `parent_guardian` role and accept the invitation.
3. Sign in as the parent and confirm the workspace lists A and B only; Student C and any other organization must remain inaccessible.
4. Open each child's attendance history and confirm older records, Absent, Present, Late and Leave statuses are shown with the correct dates.
5. Open fees and reconcile every invoice's total, paid and outstanding values against the staging ledger.
6. Repeat with an unverified email, duplicate guardian email and unrelated guardian/student links; access must fail closed.
7. Review the Parent workspace at 390px and 768px widths, then re-check Owner/Admin and Teacher sign-in and navigation.
8. Record screenshots/test evidence and obtain owner review before marking Phase 4 accepted.

## Deferred by explicit decision

- Resend SMTP delivery and custom-domain verification until the user obtains and configures a domain through the eligible GitHub Student offer.
- Online fee payment.
- Any work outside the eight Parent Workspace acceptance points.

## Safety and preservation

- Existing uncommitted repository changes were present before Phase 4 work began. They have been preserved; no reset, checkout, clean, commit, push or destructive database operation was run.
- Phase 3 Teacher Workspace and Owner/Admin workflows are not intentionally changed by this phase.


## Final automated re-verification — 2026-11-02

- Full repository API suite: **232/232 tests passed** across 32 files.
- Full repository Web suite: **119/119 tests passed** across 18 files, including Parent sibling selection, linked-child privacy, attendance history and fee invoice presentation.
- Repository-wide `npm run typecheck`: passed.
- Repository-wide `npm run build`: passed for API and Web; only existing non-fatal Zod/Rollup dependency annotation warnings appeared.
- Repository-wide `npm run lint`: passed.
- Local staging smoke: API liveness, CORS credentials for the frontend origin, API readiness/database-connected response, and frontend HTML response all passed. The staging smoke script now checks the actual API readiness response shape.
- Parent account privacy remains fail-closed: active verified guardian account is required; child records are resolved only from the authenticated parent's organization-scoped guardian links; no generic student-directory fallback is used.
- **Final remaining acceptance gate:** create synthetic Parent/Guardian + linked children + unrelated child in a disposable test organization, complete the invitation/activation workflow, reconcile attendance and fees, and manually inspect 390px/768px layouts. This run did not create or modify database records and did not send invitation emails.
- Resend/custom-domain delivery remains deferred until the GitHub Student domain decision; this does not change the verified-email and linked-child authorization rules.
- Phase 4 implementation and automated quality gates are green; keep the phase's status as **implemented — manual browser/staging acceptance pending** until the authenticated workflow is evidenced.
