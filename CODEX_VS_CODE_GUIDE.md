# Codex / VS Code — Exact Workflow

## Where to put the files

At the repository root:

`AGENTS.md`

Recommended optional project documents:

`PROMPT_INDEX.md`
`PROJECT_STATE.md`
`PLANS.md`
`DEBUGGING_GUIDE.md`
`RECOVERY_PROMPTS.md`
`REVIEW_CHECKLIST.md`

The numbered prompts can stay in:

`prompts/`

## What to paste into Agent Chat

Paste only one numbered prompt at a time.

Example:

Open:
`prompts/00-foundation.md`

Copy its contents.

Paste into the active Agent chat.

Do NOT paste:
- the whole prompt pack
- every prompt at once
- AGENTS.md every time

## Folder vs Cloud

For this project workflow use the local workspace/folder context.

Why:
- the project is on your computer
- the agent needs to inspect/edit the same workspace
- you want immediate diff review
- you are learning the repository while building it

Cloud/remote agent workflows are useful for separate remote tasks, but are not required for this first local build workflow.

## Permissions

Start with the safest/default/manual approval mode available in your chosen harness.

Review commands and file changes before allowing risky operations.

Do not give unrestricted machine access just to make the first run easier.

## If the agent does not see AGENTS.md

Check:
1. AGENTS.md is at the repository root.
2. VS Code opened the correct repository/workspace.
3. The selected harness supports AGENTS.md.
4. The workspace is trusted.
5. Agent/customization references show the file when applicable.

If it still does not use the file, mention that explicitly in chat and ask the agent to inspect and follow the root AGENTS.md.

## If the agent creates too much code

Stop the run.

Tell it:

"Stop. Stay within the current phase. Revert/undo unrelated speculative changes and only implement the current prompt's acceptance criteria."

Then inspect the diff.

## If the agent says "done"

Do not move on automatically.

Use:
`REVIEW_CHECKLIST.md`

and verify the actual repository.

## Minimal command flow

npm install
npm run dev
npm test
npm run lint
npm run typecheck
npm run build

Actual script names depend on the generated repository; use the commands that the project's package.json defines.

## Git checkpoint

After a verified phase:

git status
git diff
git add .
git commit -m "InstituteOS: complete phase XX"

Only commit after you have reviewed the changes.
