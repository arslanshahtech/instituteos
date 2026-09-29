# PROMPT 11 — SAAS BILLING

Implement InstituteOS subscription billing.

Important:
Do not confuse SaaS subscription billing with student fee collection.

## Implement

- pricing plan model
- plan features
- usage limits
- trial state
- subscription model
- subscription status
- billing history
- provider abstraction
- webhook abstraction
- upgrade
- downgrade
- cancellation
- renewal state
- feature gates
- organization billing UI

Example plan categories:
- Starter
- Growth
- Enterprise

Do not hardcode final commercial pricing.

## Critical rules

- server is authoritative for subscription state
- client cannot grant itself features
- webhook/event processing is idempotent
- provider authenticity must be verified when a real provider is connected
- billing operations must be safe against duplicate events

## Acceptance criteria

- trial state works
- subscription state works
- feature gates work
- billing history is tenant scoped
- provider integration is abstracted
- duplicate-event tests exist
