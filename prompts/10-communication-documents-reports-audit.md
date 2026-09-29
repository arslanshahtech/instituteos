# PROMPT 10 — COMMUNICATION, DOCUMENTS, REPORTS & AUDIT

Execute only operational support modules.

## Communication

Implement:
- announcements
- notification templates
- in-app notifications
- notification preferences
- email provider abstraction
- SMS/WhatsApp-ready provider abstraction
- recipient targeting
- notification history

Examples:
- absence notification
- fee reminder
- result publication
- announcement

## Documents

Implement:
- document metadata
- ownership
- secure access checks
- storage abstraction
- upload validation
- size limits
- safe file naming

Prefer object storage for large files rather than storing large binaries directly in MongoDB.

## Reports

Owner:
- enrollment
- revenue
- campus comparisons

Principal:
- attendance
- results
- staff
- finance overview

Teacher:
- class performance
- attendance
- assignments

Accountant:
- collection
- outstanding
- overdue
- payments

## Audit logs

Record important mutations:
- actor
- organization
- campus when applicable
- action
- resource
- resource ID
- timestamp
- safe metadata

Never log:
- passwords
- access tokens
- API keys
- secrets

## Acceptance criteria

- notification abstraction works
- document access is protected
- reports respect permissions
- important actions create audit records
- sensitive information is not logged
