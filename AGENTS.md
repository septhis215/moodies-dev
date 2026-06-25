# Agent Instructions

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
