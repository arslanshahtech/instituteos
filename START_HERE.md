# InstituteOS — START HERE

## 1. What this pack is

This is the complete sequential AI-engineering pack for InstituteOS.

Do NOT paste this entire pack into the AI agent at once.

Use:

1. `AGENTS.md` = permanent project rules.
2. `PROMPT_INDEX.md` = phase order and status.
3. `prompts/00-...md` = one execution task at a time.
4. `DEBUGGING_GUIDE.md` = what to do when something breaks.
5. `RECOVERY_PROMPTS.md` = ready-to-paste recovery prompts.
6. `REVIEW_CHECKLIST.md` = verification before moving to the next phase.
7. `PROJECT_STATE.md` = optional living handoff/state file.

## 2. Recommended workspace

Open the actual InstituteOS project folder in VS Code.

Example:

D:\Projects\InstituteOS

The exact path can be different; the important point is that the folder opened in VS Code is the project root.

## 3. What you create manually

At most, manually create/open the initial project folder and initialize Git if necessary.

Do NOT manually build the complete source tree.

The coding agent can create directories/files inside the workspace when its selected harness and permissions allow it.

## 4. First setup

1. Open the InstituteOS folder in VS Code.
2. Open the Agent/Chat panel.
3. Use the local Folder/workspace context, not Cloud, for this workflow.
4. Sign in to the coding agent.
5. Keep permissions conservative/default/manual while learning the workflow.
6. Ensure the repository/workspace is trusted.
7. Put `AGENTS.md` at the InstituteOS repository root.
8. Put this prompt pack somewhere safe outside the source tree too, or keep a copy in the repo under `docs/ai-engineering/`.

## 5. First execution

Paste ONLY the content of:

`prompts/00-foundation.md`

into the agent chat.

Do not paste `AGENTS.md` into chat every time. It is a project instruction file and should be discovered by the supported harness.

## 6. Phase gate

After the agent finishes Prompt 00:

1. Inspect the files changed.
2. Inspect the Git diff.
3. Run the required tests/typecheck/build.
4. Open the application.
5. Confirm the acceptance criteria.
6. Fix any issue.
7. Only then execute Prompt 01.

Repeat the same gate for every phase.

## 7. The golden rule

Never trust a statement such as:

"Done" or "All tests pass"

without checking the actual workspace/terminal output.

The repository is the source of truth.

## 8. Do not allow scope drift

During Prompt 05, for example, do not allow the agent to start building exams, finance, or AI just because it can.

Complete the current phase first.

## 9. Recommended Git checkpoints

Before each major phase:

git status

After a phase is verified:

git add .
git commit -m "InstituteOS: complete phase XX"

Do not allow the agent to commit automatically unless you explicitly want that behavior.

## 10. Learning rule

AI may generate code quickly.

You must still be able to explain:

- architecture
- data flow
- authentication
- authorization
- tenant isolation
- major business rules
- important database models
- critical API contracts
- security decisions
- AI/tool permissions
- important trade-offs

You do not need to memorize every generated line.

## 11. If anything breaks

Do NOT immediately restart the project.

Use:

`DEBUGGING_GUIDE.md`

and then one of the recovery prompts in:

`RECOVERY_PROMPTS.md`

Always provide the agent with the actual error/output instead of saying only "it doesn't work."
