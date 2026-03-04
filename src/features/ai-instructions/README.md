# ai-instructions

Shared AI tooling instructions for GitHub Copilot, Cursor, and Claude Code.

## What it does

- Creates `.github/copilot-instructions.md` — summary index for GitHub Copilot
- Creates `.github/instructions/` — canonical rule files shared across all AI tools
- Creates `.github/instructions/project/` — empty folder for project-specific rules
- Creates `.cursor/rules/` — Cursor rules index referencing the shared instructions

## Files

| File                           | Purpose                                     |
| ------------------------------ | ------------------------------------------- |
| `ai-instructions.constants.ts` | File and directory paths for the feature    |
| `ai-instructions.detect.ts`    | Check if all three entry points are present |
| `ai-instructions.apply.ts`     | Copy instructions, rules, and project dir   |
| `ai-instructions.feature.ts`   | Feature definition                          |

## Rule Files

The `.github/instructions/` directory ships with eight global rule files (`00`–`08`) covering TypeScript patterns, file naming, ESLint style, documentation, and more. These are shared across all projects.

The `.github/instructions/project/` subfolder is reserved for project-specific rules that should not be shared across projects. Add `*.instructions.md` files there and link them from `CLAUDE.md` and `.cursor/rules/RULES.md`.

## Dependency

`ai-claude` lists `ai-instructions` as an auto-dependency — running `ai-claude` on a project without `.github/instructions/` will install `ai-instructions` first.
