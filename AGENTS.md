# Agent Instructions

## Project Context Brief

Before answering questions about this repository, planning work, or editing code, read
[docs/project-context.md](./docs/project-context.md). It defines what Moodies is, the
current structure (routes, Nest modules, Prisma data model, environments), the brand and
design identity, and a list of known drift where individual files should not be trusted as
the intended pattern. Related contracts:

- [docs/typography-spec.md](./docs/typography-spec.md) — text styles; the landing page is the canonical reference.
- [ENVIRONMENTS.md](./ENVIRONMENTS.md) — env files and the `NEST_API_URL` / `NEXT_PUBLIC_API_URL` rules.
- [CONTRIBUTING.md](./CONTRIBUTING.md) — PR checklist and trunk-based branching.

Note that `SECURITY.md` is an audit prompt, not a security policy.

## Context7 CLI

Always use Context7 CLI before answering, planning, or editing code that depends on external libraries, frameworks, APIs, setup steps, configuration, migrations, dependency upgrades, or debugging.

Use the CLI through `npx` so the repo does not require a global `ctx7` install. In PowerShell on Windows, prefer `npx.cmd` to avoid script execution policy blocks. Include `--yes` so npm does not pause for an install confirmation prompt:

```powershell
npx.cmd --yes ctx7 library <library-name> "<task or question>"
npx.cmd --yes ctx7 docs <library-id> "<task or question>"
```

Inspect local project code first, then use Context7 for external documentation, then apply the docs to this codebase.

Prefer exact Context7 library IDs when known. For this repo, commonly relevant libraries include:

- `/vercel/next.js` for Next.js
- `/reactjs/react.dev` for React
- `/nestjs/docs.nestjs.com` for NestJS
- `/prisma/docs` for Prisma
- `/storybookjs/storybook` for Storybook
- `/vitest-dev/vitest` for Vitest
- `/microsoft/playwright` for Playwright
- `/tailwindlabs/tailwindcss.com` for Tailwind CSS
- `/tanstack/query` for TanStack Query

If the exact library ID is unknown, resolve it first:

```powershell
npx.cmd --yes ctx7 library nextjs "middleware route handlers app router"
```

Then query the docs:

```powershell
npx.cmd --yes ctx7 docs /vercel/next.js "Next.js 15 middleware cookies redirects"
```

Mention when Context7 was used and which library docs informed the answer. If Context7 is unavailable, say so explicitly before relying on built-in knowledge.

## Default skill workflow

These instructions apply to every conversation and every request in this
repository, subject to higher-priority instructions and the user's current
explicit directions.

At the start of each conversation, read the following skill instructions:
- .agents/skills/ponytail/SKILL.md
- .agents/skills/i-have-adhd/SKILL.md
- .agents/skills/browser-use/SKILL.md
- .agents/skills/ui-ux-pro-max/SKILL.md
- .agents/skills/humanizer/SKILL.md

Before each response or action, evaluate all five skills for applicability.
Apply relevant instructions throughout the task. Previously loaded,
unchanged instructions do not need to be reread on every turn.

If a required skill is missing or unreadable, identify the exact path.
Do not claim to have applied instructions that were not read.

Run Python skill helpers from the repository root with the existing uv-managed
Python: `uv run --offline --python 3.12 python -X utf8 -B <script> <arguments>`.
Use this launcher in place of `python` or `python3` in bundled examples; a missing
global Python command does not mean Python needs to be installed. If the cached
interpreter is unavailable, report that prerequisite before installing anything.
In PowerShell, use `codex.cmd` or `codex.exe` to avoid the unsigned `codex.ps1` shim.

Skill sources, versions, local adaptations, and installed content hashes are
recorded in `.agents/skill-sources.json`. Preserve upstream license notices.
Validate setup changes with `node --test .codex/hooks/skill-gate.test.cjs`.
Verify skill snapshots with `node .agents/scripts/check-skill-sources.cjs`.
After reviewing intentional skill edits, refresh their hashes with the same
command plus `--update`, and update source refs or adaptation notes as needed.
Hook definitions require native review through `/hooks` after changes; do not
bypass hook trust. The gate validates installed files and adds workflow context;
it does not prove that the assistant followed the instructions.

### Coding: Ponytail

Apply Ponytail in full mode by default for coding, debugging, refactoring,
code review, and dependency decisions.

Read the affected code and callers, reuse existing project patterns, and
make the smallest change that completely handles the request.

Preserve necessary validation, security, accessibility, error handling,
and verification. Minimal scope must still deliver the complete outcome.

### Communication: i-have-adhd

Apply its action-first communication principles to every response:
lead with the answer, use bounded steps, and make progress and remaining
work clear.

Explain fully when the user requests detail. Avoid invented time estimates.
Suggest a next action only when useful work remains.

### Interface work: UI/UX Pro Max

Apply when designing, building, reviewing, or fixing interfaces,
responsiveness, interaction, typography, or accessibility.

Moodies' project context, typography specification, existing tokens,
shared components, and canonical landing page govern implementation.

Treat generated palettes, fonts, icons, motion recommendations, and design
systems as advisory. Preserve the established brand unless the user
explicitly requests a redesign.

### Interactive verification: Browser Use

Apply when the task needs browser interaction, visual inspection,
screenshots, or reproduction of a user flow.

Check browser availability and the target environment before interacting.
Use a browser only when it contributes to the current task.

Keep existing Playwright, Vitest, Storybook, and Jest checks as the
project's repeatable verification mechanisms.

### Prose: Humanizer

Apply Humanizer in embedded mode to explanations, documentation,
PR descriptions, and user-facing prose.

Preserve facts, uncertainty, citations, identifiers, code, commands,
paths, configuration, data, and link targets.

Product copy must also follow Moodies' established voice and vocabulary.

### Conflicts and completion

Project contracts and explicit user requirements take precedence over
generic recommendations from these skills.

Preserve the existing Context7 workflow for external-library documentation.

Combine overlapping output requirements into a clear response.
Report completed work, verification performed, and material limitations.
