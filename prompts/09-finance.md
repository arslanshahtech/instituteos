# PROMPT 09 — FEES & FINANCE

Execute only the institute/student fee domain.

Important:
This is NOT InstituteOS SaaS subscription billing. SaaS billing is Phase 11.

## Implement

- fee structures
- academic/class/campus applicability
- student fee assignment
- invoices
- installments
- discounts
- due dates
- payments
- receipts
- refunds
- outstanding balances
- overdue states
- payment history
- financial summaries
- finance dashboard

## Flow

Fee Structure
→ Assignment
→ Invoice
→ Payment
→ Receipt
→ Report

## Money safety

Do not use unsafe floating-point calculations for money.

Choose a deliberate representation and document it.

## Payment provider abstraction

Create a provider interface so a real provider can be integrated later without coupling business logic to one vendor.

## Idempotency

Design duplicate payment/event handling safely.

## Frontend

- finance dashboard
- fee structures
- invoices
- dues
- payment recording
- receipts
- refunds
- finance reports

## Acceptance criteria

- balances are consistent
- duplicate payment handling is safe
- refunds update state correctly
- finance permissions work
- tenant isolation works
- financial tests pass
