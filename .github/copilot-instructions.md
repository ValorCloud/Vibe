# Vibe — Coding Rules

These rules apply to all AI agents (GitHub Copilot, Copilot Chat, Copilot Workspace, etc.) working on this repository.
Rules are ordered by priority — repo-specific rules (sections 1–5) override generic ones (sections below) when they conflict.

---

⚠️ **INIT**: Before any analysis, remind the user in one sentence to verify that the `@github` and `@vercel` connectors are active (absolute sources of truth for the workspace).

---

## 1. Posture & Communication

- **Interpret intent, not the letter:** Understand the real objective, context, and expected deliverable. Prefer practical utility over literal execution.
- **Scope by default = strict letter.** Exceed the explicit scope only if intent is unambiguous AND impact is ≤ 3 files. Otherwise, ask.
- **Ambiguity handling:** Minor = decide silently; Medium = briefly state the assumption; Major = give the most likely path + 1–2 concise variants. Never invent constraints or facts.
- **Style:** Zero filler. Direct responses, ready to implement. Do not expose internal reasoning. On failure: read logs directly, infer nothing, minimize interactions.

## 2. Execution & Architecture

- **Immediate action:** Apply changes directly inline (files, configs, commands). No pseudo-code, no deferred actions or promises.
- **UI/UX:** Exclusive use of **Microsoft Fluent UI (Fluent 2)**. No mixing design systems. Everything must be PWA-compliant and responsive.
- **Versioning:** Increment the *sub-minor-minor* version everywhere (package.json, manifests, headers) on every source code change. Format: `x.y.z.w` where `w` is the internal patch counter (e.g. `1.2.3.4 → 1.2.3.5`). If 4-segment versions are unsupported, record the build number in the commit message (e.g. `v1.2.3 build 5`).

## 3. Repo Hygiene — Strict & Non-Negotiable

### A. package.json (Canonical Rule)

- **Mandatory SHA read before any push that includes package.json:** Read the file via the GitHub API (`get_file_contents`) to retrieve the current SHA AND full content. Never reconstruct it from memory.
- **Full content only:** The committed `package.json` must include all fields (`name`, `version`, `scripts`, `dependencies`, `devDependencies`, etc.) — never a partial skeleton.
- **Bumped version:** Increment `version` sub-minor-minor in the full retrieved content, never in a skeleton.
- **npm verification:** Verify each version exists before committing (`npm show <pkg>@<version>`).
- **Dependency rule:** `dependencies` = runtime (imported in `src/` for prod: *react, @fluentui/x, zod, motion*). `devDependencies` = build/tests (*vite, typescript, eslint, vitest*). When in doubt: if imported in `src/` → `dependencies`.

### B. Refactoring & TypeScript

- **Exhaustive search:** Run "find all references" before modifying any interface/type/prop.
  - 0 consumers → deletion allowed in the same commit.
  - ≥1 consumer → atomic migration required: old + new in the same diff, all call-sites updated.
- **TS discipline:** Mentally simulate `tsc --noEmit` before committing. Zero implicit `any` (TS7006), zero missing module (TS2307).
- **Strict casts:** No `as Type` casts without a type-guard on unknown payloads.
- **Global extensions:** Any interface extending `Window` (e.g. `WindowWithWebkitAudio`) must also declare the standard properties it uses (`AudioContext: typeof AudioContext`).

### C. Commits & CI/CD

- **Atomicity:** 1 commit = 1 problem solved + ALL its consumers updated. Never leave broken code for a "next commit". If >5 files, split sequentially with a valid build at each step.
- **Regression check:** Assess risk on the full diff before committing. Report status (fixed/remaining) after the commit.
- **Failure resolution (Vercel/Actions):** Read logs (API/UI). Target the root cause (the *first* error in the stack, not the last). Fix everything in one exhaustive session.
- **Tests and immediacy:** Tests are blocking for merge, not for commit. A commit without tests is allowed if a test commit follows in the same session.

## 4. General Approach

- Always check for a PRD (Product Requirements Document) before starting a new task and follow it closely.
- Look for comprehensive project documentation to understand requirements before making changes.
- Focus only on code areas relevant to the assigned task.
- Prefer iterating on existing code rather than creating new solutions.
- Keep solutions simple and avoid introducing unnecessary complexity.
- Consider what other code areas might be affected by your changes.
- Don't drastically change existing patterns without explicit instruction.
- Exhaust all options using existing implementations before introducing new patterns.
- If introducing a new pattern to replace an old one, remove the old implementation — after verifying all consumers are migrated (see §3B).

## 5. Code Quality

- Keep files under 300 lines of code; refactor when approaching this limit.
- Maintain a clean, organized codebase.
- Avoid code duplication by checking for similar existing functionality.
- Write thorough tests for all major functionality. All tests must pass before merging to production. If they don't, notify the user.
- Consider different environments (dev, test, prod) when writing code.
- Fix the underlying issue rather than gracefully handling errors, unless explicitly instructed otherwise.
- When refactoring, look for duplicate code, duplicate files, and similar existing functionality. Do not copy files and rename them — edit the file that already exists.

## 6. Debugging & Issue Tracking

- On a persistent error: write logs and console messages to track the issue, then check the logs after changes to verify resolution.
- For issues requiring multiple iterations: after fixing, write a description of the problem and solution in `fixes/<issue-name>.md`. Only for major issues.
- Before starting, check the `fixes/` folder for prior resolutions of the same issue.

## 7. Documentation

- Keep a running list of patterns and technology used in `README.md`.
- Reference `README.md` for patterns and technology before making architectural decisions.

## 8. Git & Version Control

- Never leave unstaged/untracked files after committing.
- Don't create new branches unless explicitly requested.
- Never commit `.env` files to version control.
- Never overwrite `.env` files without explicit confirmation.
- Never name files `improved-something` or `refactored-something`.

## 9. Dev Server

- Kill all related running servers before starting a new one.
- Always start a new server after making changes to allow for testing.

## 10. Data & Mocking

- Avoid writing one-time scripts in permanent files.
- Don't mock data except for tests (never for dev or prod environments).

---

## Pre-Commit Checklist (Mandatory)

- [ ] `package.json` read from GitHub API (SHA retrieved, full content used).
- [ ] npm versions verified (`npm show <pkg>@<version>`).
- [ ] All consumers of modified symbols included in the diff.
- [ ] Zero implicit `any` (TS7006) or missing module (TS2307).
- [ ] No new TypeScript errors (`tsc --noEmit` clean).
- [ ] Existing tests green (`vitest run`) or deviation documented.
- [ ] No debug `console.log` left in the diff.
- [ ] Full diff reviewed: I/O consistency of each component verified.
