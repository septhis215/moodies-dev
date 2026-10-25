---
name: slides
description: Create strategic HTML presentations with Chart.js, design tokens, responsive layouts, copywriting formulas, and contextual slide strategies.
metadata:
  author: claudekit
  version: "1.0.0"
---

# Slides

Strategic HTML presentation design with data visualization.

Run knowledge-base helper commands from the project root; they live in the sibling `.agents/skills/design-system/` skill. Reuse Moodies' existing brand contracts for branded slides. Use the installed `presentations` skill when the user requests PowerPoint or Google Slides rather than HTML.

## When to Use

- Marketing presentations and pitch decks
- Data-driven slides with Chart.js
- Strategic slide design with layout patterns
- Copywriting-optimized presentation content

## Subcommands

| Subcommand | Description | Reference |
|------------|-------------|-----------|
| `create` | Create strategic presentation slides | `references/create.md` |

## References (Knowledge Base)

| Topic | File |
|-------|------|
| Layout Patterns | `references/layout-patterns.md` |
| HTML Template | `references/html-template.md` |
| Copywriting Formulas | `references/copywriting-formulas.md` |
| Slide Strategies | `references/slide-strategies.md` |

## Routing

1. Determine the requested operation from the user's request
2. Load corresponding `references/{subcommand}.md`
3. Execute with remaining arguments
