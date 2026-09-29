# PROMPT 03 — AUTHENTICATION & IDENTITY

Execute only authentication and identity.

Read `AGENTS.md`.

## Objective

Implement secure application authentication for InstituteOS.

## Backend

Implement:
- User model
- registration
- password hashing
- login
- logout
- secure session/refresh strategy
- password change
- password reset flow
- email verification architecture
- account status
- authentication middleware
- current-user endpoint
- sensitive endpoint rate limits
- authentication tests

Use secure HttpOnly cookies or an equally well-justified secure strategy.

Do not expose passwords, password hashes, reset secrets, tokens, or sensitive internals.

## Frontend

Implement:
- login
- registration
- forgot password
- reset password
- verification state
- protected routes
- current-user bootstrap
- logout
- auth loading state
- unauthorized state

## Do not implement yet

- multi-tenancy authorization
- full RBAC
- student modules
- academics
- finance
- AI

Authentication answers "who are you".

Authorization belongs to the next phase.

## Acceptance criteria

- registration works
- login works
- invalid credentials fail safely
- authenticated user survives refresh
- logout works
- protected routes work
- password reset architecture works
- auth tests pass
- no sensitive secrets appear in responses/logs
