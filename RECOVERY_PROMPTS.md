# InstituteOS — Ready-to-Paste Recovery Prompts

## RECOVERY 01 — Diagnose Only

Act as a senior debugging engineer.

Do not modify any files yet.

Inspect the current workspace and diagnose this issue.

Exact error:
[PASTE ERROR]

Command that produced it:
[PASTE COMMAND]

Expected behavior:
[EXPECTED]

Actual behavior:
[ACTUAL]

Recent change:
[RECENT CHANGE]

Tasks:
1. identify the failing layer
2. identify the most likely root cause
3. inspect the relevant files
4. propose the smallest safe fix
5. explain why the failure occurred
6. list the tests you will run after the fix

Do not rewrite unrelated code.
Do not implement future features.

---

## RECOVERY 02 — Fix and Verify

Use the previously diagnosed root cause to implement the smallest safe fix.

Before editing:
- inspect current files
- confirm the diagnosis

Then:
1. make only necessary changes
2. preserve unrelated behavior
3. run the most relevant test
4. run typecheck/lint when applicable
5. run build when applicable
6. report changed files
7. report commands/results
8. report any remaining issue

Do not claim success without actual verification.

---

## RECOVERY 03 — Regression Investigation

A previously working feature has broken after a recent change.

Inspect Git diff and current code.

Determine:
1. what changed
2. which change likely caused the regression
3. how to reproduce
4. smallest repair
5. regression test needed

Do not revert the whole project.
Do not rewrite unrelated modules.

---

## RECOVERY 04 — Tenant Security Audit

Investigate a suspected multi-tenant data exposure.

Scenario:
[DESCRIBE]

Test whether a user from Organization A can access or mutate Organization B data.

Inspect:
- authentication
- organization context
- membership
- authorization
- route parameters
- service logic
- database filters
- indexes

Do not weaken authorization just to make the request succeed.

Implement a regression test proving the isolation boundary.

---

## RECOVERY 05 — AI Tool Security Audit

Investigate an AI assistant issue.

Scenario:
[DESCRIBE]

Check:
- tenant context
- user permissions
- tool allowlist
- argument validation
- prompt injection resistance
- sensitive-data exposure
- unauthorized database access
- output validation

Do not grant the AI unrestricted database access.

Report findings by severity and fix critical/high issues when safe.
