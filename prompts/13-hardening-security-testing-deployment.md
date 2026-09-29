# PROMPT 13 — PRODUCTION HARDENING, SECURITY, TESTING & DEPLOYMENT

Treat InstituteOS as a production candidate.

Do NOT add large new business features.

## Security audit

Review:
- authentication
- sessions/tokens/cookies
- password handling
- rate limits
- authorization
- RBAC
- object-level access
- tenant isolation
- IDOR
- privilege escalation
- CORS
- security headers
- validation
- file uploads
- secret handling
- logging
- audit records
- finance idempotency
- AI prompt injection
- AI tool authorization
- AI tenant isolation
- AI output validation

## Database review

Check:
- indexes
- slow queries
- pagination
- duplicate prevention
- tenant-aware indexes
- consistency rules

## Frontend review

Check:
- routes
- loading
- empty
- error
- permission-denied
- responsive behavior
- accessibility
- unsafe data exposure

## Testing

Create or improve:
- unit tests
- integration tests
- API tests
- authorization tests
- cross-tenant tests
- critical UI tests
- end-to-end smoke tests where practical

Run:
- tests
- typecheck
- lint
- production build

## Deployment readiness

Verify:
- environment variables
- database config
- frontend production config
- backend production config
- logging
- health checks
- CI/CD readiness
- deployment documentation

Categorize findings:
Critical
High
Medium
Low

Fix critical/high issues when safe and within the current scope.

Do not claim production-ready unless evidence supports it.
