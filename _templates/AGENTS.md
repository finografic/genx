# AGENTS.md - AI Assistant Guide

## Rules - General

Rules are canonical in `.github/instructions/` and shared across Claude Code, Cursor, and GitHub Copilot.
Follow general TypeScript, ESLint, and naming conventions from prior context.

- [General](/.github/instructions/00-general.instructions.md)
- [File Naming](/.github/instructions/01-file-naming.instructions.md)
- [TypeScript Patterns](/.github/instructions/02-typescript-patterns.instructions.md)
- [Provider & Context Patterns](/.github/instructions/03-provider-context-patterns.instructions.md)
- [ESLint & Code Style](/.github/instructions/04-eslint-code-style.instructions.md)
- [Documentation](/.github/instructions/05-documentation.instructions.md)
- [Modern TypeScript Patterns](/.github/instructions/06-modern-typescript-patterns.instructions.md)
- [Variable Naming](/.github/instructions/07-variable-naming.instructions.md)
- [README Standards](/.github/instructions/08-readme-standards.instructions.md)
- [Picocolors CLI styling](/.github/instructions/09-picocolors-cli-styling.instructions.md)
- [Git Policy](/.github/instructions/10-git-policy.instructions.md)

## Rules - Project-Specific

Project-specific rules live in `.github/instructions/project/**/*.instructions.md`.

<!-- NOTE: CLI projects (genx:type:cli keyword in package.json) only -->

- Generated README sections are managed by `pnpm docs:usage` — never edit content between `<!-- GENERATED:*:START/END -->` markers by hand.

- Published to GitHub Packages (`https://npm.pkg.github.com`).
- Do not reference `@workspace/*` — all imports and deps must use published package names.

## Rules - Markdown Tables

- Padded pipes: one space on each side of every `|`, including the separator row.
- Align column widths so all cells in the same column are equal width.

## Git Policy

- IMPORTANT: NEVER include `Co-Authored-By` lines in commit messages. Not ever, not for any reason.
- [Git — Commits](/.github/instructions/10-git-policy.instructions.md#commits)
- [Git — Releases](/.github/instructions/10-git-policy.instructions.md#releases)

## Learned User Preferences

- Cursor loads rules under `.cursor/rules/` recursively, including nested folders; mixed flat-plus-subfolder layouts are a known pain point in multi-root workspaces
- The `create` command copies `_templates/` with relative paths preserved into the new package; extra directory tiers (e.g. `root/`) land under those names in the target unless copy logic is changed
- `path.resolve('src/...', …)` in scripts follows the process cwd; pnpm/npm scripts run with the package root as cwd, so repo-relative paths match the real tree when invoked that way
- This repo can surface multiple `lint-staged` configs (root and `_templates/package.json`); grouped tasks follow the nearest config per staged file
