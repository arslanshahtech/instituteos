# InstituteOS — AI Workflow

## Human role

You are the engineering owner.

You define:
- product requirements
- acceptance criteria
- architecture decisions
- scope
- final approval

## AI role

The coding agent can act as:
- implementation engineer
- test engineer
- debugger
- reviewer
- documentation assistant

## Standard loop

Plan
→ Implement
→ Test
→ Inspect
→ Fix
→ Verify
→ Document
→ Accept

## Three things that must remain human-reviewed

### 1. Security boundaries

Especially:
- auth
- RBAC
- tenant isolation
- finance
- file access
- AI tools

### 2. Core business rules

Especially:
- enrollment
- timetable conflicts
- fee balances
- subscription status
- role scopes

### 3. Architectural trade-offs

Do not blindly accept a generated architecture because it is verbose or impressive.

Prefer the smallest design that meets the requirement safely.
