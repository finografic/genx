# AGENTS.md — AI Assistant Guide

## Rules — Project-Specific

Project-specific rules live in `.github/instructions/project/**/*.instructions.md`.

<!-- NOTE: CLI projects (genx:type:cli keyword in package.json) only -->

- Generated README sections are managed by `pnpm docs:usage` — never edit content between `<!-- GENERATED:*:START/END -->` markers by hand.

- Do not reference `@workspace/*` — all imports and deps must use published package names.

## Rules — General

Rules are canonical in `.github/instructions/` and shared across Claude Code, Cursor, and GitHub Copilot.
Follow general TypeScript, ESLint, and naming conventions from prior context.

- General: `.github/instructions/00-general.instructions.md`
- File Naming: `.github/instructions/01-file-naming.instructions.md`
- TypeScript: `.github/instructions/02-typescript-patterns.instructions.md`
- ESLint & Style: `.github/instructions/04-eslint-code-style.instructions.md`
- Documentation: `.github/instructions/05-documentation.instructions.md`
- Modern TS Patterns: `.github/instructions/06-modern-typescript-patterns.instructions.md`
- Variable Naming: `.github/instructions/07-variable-naming.instructions.md`
- README Standards: `.github/instructions/08-readme-standards.instructions.md`
- Picocolors CLI styling: `.github/instructions/09-picocolors-cli-styling.instructions.md`
- Git Policy: `.github/instructions/10-git-policy.instructions.md`
- Agent-facing Markdown: `.github/instructions/11-agent-facing-markdown.instructions.md`

---

## Rules — Markdown Tables

- Padded pipes: one space on each side of every `|`, including the separator row.
- Align column widths so all cells in the same column are equal width.

---

## Git Policy

- IMPORTANT: NEVER include `Co-Authored-By` lines in commit messages. Non-negotiable.
- `.github/instructions/10-git-policy.instructions.md` (see Commits and Releases sections)

---
