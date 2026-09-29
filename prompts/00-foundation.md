# PROMPT 00 — FOUNDATION

You are executing Phase 00 of the InstituteOS project.

Read the repository root `AGENTS.md` first.

Inspect the current workspace before making changes.

## Objective

Establish the initial engineering foundation for a professional modular-monolith SaaS without implementing business modules yet.

## Requirements

1. Determine whether the repository is empty or partially built.
2. Preserve any working existing code.
3. Establish frontend/backend project structure.
4. Establish TypeScript only if this is a new project or migration is explicitly justified.
5. Establish linting and formatting.
6. Establish environment configuration.
7. Create/update `.env.example` without real secrets.
8. Establish a docs structure.
9. Create/update:
   - `docs/architecture.md`
   - `docs/decisions.md`
   - `docs/INSTITUTEOS_CONTRACT.md`
10. Create/update a usable root README.
11. Configure `.gitignore`.
12. Establish a test foundation.
13. Establish a backend health endpoint foundation.
14. Establish `/api/v1` routing foundation.
15. Establish basic package scripts for development, test, lint, typecheck, and build where appropriate.

## Do not

- implement authentication
- implement students
- implement academics
- implement finance
- implement AI
- implement SaaS billing
- introduce microservices
- rewrite unrelated working code

## Acceptance criteria

- frontend starts
- backend starts
- health endpoint works
- `/api/v1` foundation works
- environment setup documented
- lint works
- typecheck works
- tests can run
- build works where applicable
- no secrets are hardcoded

## Verification

Run the appropriate install, lint, typecheck, test, and build commands.

Report actual outputs.

## Final response

Provide:
- files created/modified
- commands run
- verification results
- known issues
- confirmation that no future business modules were implemented
