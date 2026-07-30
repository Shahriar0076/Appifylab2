# Copy This Into Pi

Paste the prompt below into Pi while DeepSeek Flash is opened in this project.

```text
Work in the current project directory.

This project already contains a complete refactor plan inside `.refactor`.

First read these files completely:

1. `.refactor/README.md`
2. `.refactor/00-START-HERE.md`
3. `.refactor/11-DEEPSEEK-FLASH-TASKS.md`
4. `.refactor/12-EXECUTION-CHECKLIST.md`

Then execute ONLY the first task that is not marked PASS in
`.refactor/12-EXECUTION-CHECKLIST.md`.

Before executing it:

- Read every additional plan file and source file named by that task.
- Inspect `git status --short`.
- Preserve unrelated changes.

While executing:

- Follow `.refactor/00-START-HERE.md` exactly.
- Complete only one DSF task.
- Do not start the next task automatically.
- Add or update tests before changing behavior.
- Preserve the existing UI, JSX structure, CSS classes, responsive design,
  visible copy, and interactions.
- Do not read or expose `.env.local` or
  `scripts/service-account.json`.
- Do not run `scripts/seed.mjs`.
- Do not deploy Firebase rules, indexes, hosting, functions, or application
  builds.
- Do not discard or silently delete pending local data.
- Do not weaken security rules to make tests pass.

Before finishing:

- Run every verification command required by the task.
- Run `npm run lint`.
- Run `npm run build`.
- Run `git diff --check`.
- Review the complete diff for accidental UI, generated-file, secret, or
  unrelated changes.
- Update `.refactor/12-EXECUTION-CHECKLIST.md` with the task status, commands,
  results, decisions, and remaining risks.
- Stop after this task's gate.

Return this exact handoff:

Task:
Invariant protected:
Files changed:
Tests added/changed:
Commands and results:
Legacy behavior retained:
Known risks:
Gate: PASS | FAIL | BLOCKED
Next safe task:

Never report PASS for a command that was not run.
```

## What to do afterward

When Pi finishes successfully, review its result and paste the same prompt
again. It will read the checklist and select the next task that is not marked
`PASS`.

Do not ask it to complete every task in a single run.

