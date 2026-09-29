# InstituteOS — Debugging & Error Handling Guide

## First rule

Never describe a bug as:

"Code is not working."

Capture evidence.

Use:

1. exact error message
2. file path
3. line number if available
4. command that produced it
5. expected behavior
6. actual behavior
7. recent change that happened before the issue

## Debugging loop

Observe
→ classify the layer
→ reproduce
→ form one hypothesis
→ test it
→ inspect result
→ fix
→ run regression tests

Do not change five unrelated things at once.

## Layer map

### Frontend

Typical symptoms:
- blank screen
- broken route
- component crash
- API data not displayed
- form not submitting

Check:
- browser console
- network request
- response status/body
- React component tree
- route configuration
- query state

### API/Express

Typical symptoms:
- 400
- 401
- 403
- 404
- 409
- 422
- 429
- 500

Check:
- route registration
- HTTP method
- middleware order
- authentication state
- tenant context
- permission result
- validation result
- controller/service error
- logs
- response body

### Database/Mongoose

Typical symptoms:
- validation error
- duplicate key
- missing data
- incorrect query
- slow query

Check:
- schema
- required fields
- indexes
- query filter
- organizationId/tenant scope
- ObjectId handling
- population/projection
- data actually stored

### Authentication

Check:
- token/cookie existence
- expiry
- cookie security attributes
- current-user endpoint
- password hashing
- refresh flow
- middleware ordering

### Authorization

For every 403 or suspicious access:
- authenticated user
- organization membership
- role
- permission
- resource ownership
- campus scope

### Multi-tenancy

For any possible tenant leak:
1. identify current organization
2. identify resource organization
3. inspect server-side query filter
4. attempt same resource from another tenant
5. confirm failure
6. add regression test

### Finance

Check:
- invoice state
- payment idempotency
- duplicate events
- balance calculation
- refund logic
- money representation

### AI

Check:
- provider request
- model response
- tool selection
- tool argument validation
- tenant context
- permission context
- output schema
- rate/usage limits
- prompt injection attempt

## Error handling standard

Errors should be:
- predictable
- structured
- safe for the client
- detailed in server logs
- free of secrets

Do not expose:
- stack traces in production responses
- database credentials
- tokens
- internal secrets
- sensitive records belonging to other tenants

## Status-code baseline

Use status codes consistently.

400 = malformed request
401 = unauthenticated
403 = authenticated but not authorized
404 = resource not found or intentionally hidden
409 = conflict
422 = validation/business input failure where the API convention uses it
429 = rate limit
500 = unexpected server failure

Do not blindly change codes to make tests green.

## When an AI agent gets stuck

Give it:
- exact command
- exact error
- changed files
- last known-good behavior

Then ask for diagnosis before asking for a rewrite.

## Never use this as a debugging strategy

"Rewrite everything."

It destroys information about the failure and can introduce new bugs.

## Before declaring fixed

Run the narrowest useful test first.

Then:
- relevant integration test
- broader test suite
- typecheck
- lint
- build when applicable

Then manually verify the affected behavior.
