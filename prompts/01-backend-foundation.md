# PROMPT 01 — BACKEND FOUNDATION

Execute only the backend foundation phase.

Read `AGENTS.md`.

Inspect the backend before editing.

## Objective

Create a production-oriented Node.js + Express + MongoDB/Mongoose backend foundation for InstituteOS.

## Implement

- Express bootstrap
- HTTP server bootstrap
- environment configuration
- MongoDB/Mongoose connection
- `/api/v1`
- health endpoint
- readiness endpoint if useful
- central error class
- centralized error middleware
- async request handling
- 404 handling
- structured error responses
- request/correlation ID
- safe request logging
- security headers
- CORS configuration
- rate limiting foundation
- graceful shutdown
- database connection failure handling
- base module structure
- backend test foundation

## Architecture

Use:

Route
→ Middleware
→ Controller
→ Service
→ Repository/Data Access
→ Model

Do not place large business workflows in controllers.

## Do not implement

- authentication
- RBAC
- students
- academics
- finance
- billing
- AI

## Acceptance criteria

- server starts
- database connection is configurable
- health endpoint succeeds
- unknown routes return structured errors
- error handling is centralized
- rate limiting foundation works
- CORS is configurable
- graceful shutdown exists
- tests run
- lint/typecheck/build pass where applicable

Report actual evidence.
