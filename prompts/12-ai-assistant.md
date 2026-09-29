# PROMPT 12 — AI ASSISTANT

Implement the InstituteOS AI Assistant.

Do NOT build a generic ChatGPT clone.

The AI must operate through authorized application capabilities.

## Architecture

AI Provider
→ Orchestration
→ Allowlisted Tools/Services
→ Tenant Scope
→ Permission Scope
→ Validated Output
→ Audit/Usage Tracking

## Implement

- AI provider abstraction
- configuration
- conversation model
- message model
- usage tracking
- tool abstraction
- permission-aware tool execution
- structured output validation
- AI error handling
- usage/rate limits
- prompt/version management foundation
- AI audit logging

## Initial capabilities

Natural-language analytics:
- "How much outstanding fee exists this month?"
- "Which campus has the highest absenteeism?"
- "How many active Grade 8 students are there?"

Report generation:
- "Generate a monthly principal summary."

Communication drafting:
- "Draft an Urdu fee reminder."

Administrative assistant:
- "Summarize this month's attendance."

## Security

The AI must never bypass application permissions.

Do not give the model unrestricted database access.

Use explicit tools with:
- allowlisted operations
- validated arguments
- current tenant context
- current user permissions

Protect against:
- prompt injection
- cross-tenant leakage
- unauthorized tool usage
- sensitive data exposure
- unsafe output

## Acceptance criteria

- provider is replaceable
- tools are permission checked
- tenant isolation remains intact
- tool arguments are validated
- AI usage is tracked
- failures are handled gracefully
- representative security/integration tests exist
