# Finance Module — Locked Scope and Acceptance Criteria

## Product goal
Make finance usable for daily institute fee operations with a clean, low-friction workflow. Keep organization and campus isolation intact.

## Primary workflow
1. Configure campuses, classes/sections, academic years, and fee structures in the existing Academic/Classes setup. Do not create a duplicate campus registry inside Finance.
2. Open **Create invoices**, select academic year, class, matching fee structure, billing cycle, and due date.
3. Generate one invoice for every active student with an active placement in the selected class and academic year. A separate active Enrollment record must not silently exclude a student whose class placement is valid.
4. Skip invoices already created for the same student, fee structure, and billing cycle; report created and skipped counts.
5. Open **Fee ledger** to filter by campus, class, and status. Date filters stay under “More filters”.
6. Record a full or partial payment; derive Unpaid / Partial / Paid / Overdue from the recorded amounts and due date.
7. Provide a printable/downloadable receipt, student ledger, and export of the currently filtered fee ledger.

## Invoice and accounting rules
- Human-readable invoice references use a short sequential format scoped to an organization, for example `INV-26-000123`; internal MongoDB IDs remain internal.
- Receipt references are separate from invoice references.
- Payments must not exceed the outstanding balance. A partial payment leaves a due balance; a fully paid invoice has zero due.
- Preserve payment history and auditability. Do not permanently delete financial records through an ordinary list action.
- Apply discounts/concessions only through the existing authorized workflow.
- Every query and mutation remains scoped by organization and authorized campus IDs.

## UX requirements
- Keep the primary ledger filters limited to Campus, Class, and Payment status. Date range filters are collapsed under “More filters”.
- Invoice list should clearly show student, invoice reference, class, total, paid, due, status, and a small set of actions.
- Remove the ordinary Delete action from the invoice list.
- Use the existing campus/class/section administration instead of adding another source of truth.
- Keep the UI responsive, keyboard-accessible, and readable on mobile.

## Verification checklist
- A class with 30 active students placed in the selected academic year generates 30 invoices unless some already exist for the same billing cycle.
- Students with valid class placements are not dropped only because their Enrollment document is absent or stale.
- Re-running the same billing cycle does not create duplicates.
- Payment amounts, status, due balance, receipt, and ledger stay consistent for unpaid, partial, and paid cases.
- Cross-organization and out-of-scope campus records are never visible or mutable.
- Verify PDF/print output, browser workflow, and real database behavior before declaring production readiness.
