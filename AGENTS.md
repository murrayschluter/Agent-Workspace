# Agent rules for this repo

Read this file before making any change to `murrayschluter/Agent-Workspace`. Two humans and two agents share this repo: Murray Schluter (admin) and Riyad (collaborator, GitHub login `bpg-ant`). Both have push.

## Branching
- Never edit on `main`. Always create a branch first.
- Branch naming: `<type>/<owner>-<short-slug>`
  - `<type>` = `feat` | `fix` | `chore` | `ops`
  - `<owner>` = `murray` | `ant` (the human responsible)
  - Examples: `feat/murray-vendor-email`, `fix/ant-sms-error`
- One scope per branch. No drive-by edits in unrelated files.

## Pull requests
- Open a Draft PR as soon as the branch has its first commit. The Draft PR is the visible "I'm working here" signal to the other team.
- Before touching a file, run `gh pr list` and check open PRs. If your target file appears in another open PR, stop and surface the collision to the human.
- PR description must include: what changed, why, how to test locally, DB/schema impact, screenshots if UI.
- The *other* human approves before merge:
  - `ant/...` branches → approved by Murray
  - `murray/...` branches → approved by Riyad
- Squash-merge by default. Delete the branch after merge.
- Do not self-approve or self-merge.

## `main` is protected
- Never push directly to `main`. Never force-push. Never delete `main`.

## Secrets
- Never commit `.env`, `.env.local`, or any file containing API keys, Supabase keys, or ClickSend credentials. They are gitignored — do not move them out.
- If a secret leaks into a diff, abort the commit, tell the human, and rotate the key.

## Database / Supabase
- `supabase/*.sql` is stateful and can wipe shared data. Do not run any SQL file against the shared Supabase project.
- If your task changes the schema: write a migration SQL, document apply + rollback steps in the PR description, and let the human run it.
- Do not change RLS, auth, or storage bucket settings without explicit human approval in the PR.

## Lockfile
- Do not commit `package-lock.json` changes unless you intentionally added or upgraded a dependency. Lockfile drift from a fresh `npm install` should not land in a feature PR.

## Vendor-facing copy
- Australian English. Plain-spoken. First names only.
- No em dashes anywhere in vendor-facing copy or in AI prompts that produce vendor-facing copy.

## Destructive git
- No `git reset --hard`, `git push --force`, branch deletion, or history rewrite without the human typing the exact command in chat.

## Uncertainty
- If a task is ambiguous, ask the human before writing code. Do not guess and push.

## Human checkpoints

When this repo or a task brief says "wait until the human confirms", do **not** accept a reply of "done", "ok", "yep", or "go". The human must paste the **output of a specific verification command** that proves the state you were waiting for. If the human skips the verification, ask them to run the command and paste the result before you continue.

This rule exists because soft confirmations have produced false-positives in this repo before — including the PR that installed the rest of the governance scaffolding.
