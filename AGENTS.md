# AGENTS.md - AI Assistant Guide

Rules are canonical in `.github/instructions/` and shared across Claude Code, Cursor, and GitHub Copilot.

## Rules - General

- IMPORTANT: NEVER include `Co-Authored-By` lines in commit messages.

## Rules - Markdown Tables

- Padded pipes: one space on each side of every `|`, including the separator row.
- Align column widths so all cells in the same column are equal width.

## Rule Files

> Note: the full `.github/instructions/` rule set from the monorepo has not been copied here yet.
> Until it is, follow general TypeScript, ESLint, and naming conventions from prior context.

- [General](/.github/instructions/00-general.instructions.md)
- [File Naming](/.github/instructions/01-file-naming.instructions.md)
- [TypeScript Patterns](/.github/instructions/02-typescript-patterns.instructions.md)
- [Provider & Context Patterns](/.github/instructions/03-provider-context-patterns.instructions.md)
- [ESLint & Code Style](/.github/instructions/04-eslint-code-style.instructions.md)
- [Documentation](/.github/instructions/05-documentation.instructions.md)
- [Modern TypeScript Patterns](/.github/instructions/06-modern-typescript-patterns.instructions.md)
- [Variable Naming](/.github/instructions/07-variable-naming.instructions.md)
- [README Standards](/.github/instructions/08-readme-standards.instructions.md)

## Project-Specific

Project-specific rules live in `.github/instructions/project/`. Add `*.instructions.md` files there and link them here.
These rules are specific to `@finografic/genx` and not shared with other projects.

<!-- NOTE: @finografic/genx only -->

- Generated README sections are managed by `pnpm docs.usage` — never edit content between `<!-- GENERATED:*:START/END -->` markers by hand.
- When adding a command, update the `commands` array in `src/[binary].help.ts` and add a matching entry to the `EXAMPLES` section.

- [Feature Patterns](/.github/instructions/project/feature-patterns.instructions.md)

- This is a **standalone installable package** (`@finografic/design-system`), not a monorepo workspace.
- Published to GitHub Packages (`https://npm.pkg.github.com`).
- Do not reference `@workspace/*` — all imports and deps must use published package names.
- The `panda.preset` entry must always build with `platform: 'node'` in tsdown.
- Never add `watch: true` to `panda.config.ts` — it causes `panda codegen` to hang.

## Learned User Preferences

- Follow existing recipe patterns for naming, structure, and variant conventions
- Apply recipes inside design-system components; client uses `<Button variant="..." />` without calling the recipe
- Use cva for single-element components (e.g. Button); use sva for multi-slot components (Checkbox, Card, Dialog)
- Use @stylistic/stylelint-plugin for Stylelint 17; stylelint-stylistic is deprecated and incompatible
- Ignore .cursor/chats and .cursor/hooks; commit .cursor/mcp.json
- Use Panda MCP for design-system questions (breakpoints, tokens, recipes) when relevant without explicit user ask
- When hooks seem to skip formatting that `dprint check` catches, confirm files are staged; use `npx lint-staged --debug` and verify paths under the “staged files” list
- For Clack `text` validators, normalize once with `const trimmed = value?.trim() ?? ''`, require non-empty `trimmed`, then run regex tests on `trimmed` (covers undefined and satisfies narrowing)

## Learned Workspace Facts

- Cursor loads rules under `.cursor/rules/` recursively, including nested folders; mixed flat-plus-subfolder layouts are a known pain point in multi-root workspaces
- The `create` command copies `_templates/` with relative paths preserved into the new package; extra directory tiers (e.g. `root/`) land under those names in the target unless copy logic is changed
- `path.resolve('src/...', …)` in scripts follows the process cwd; pnpm/npm scripts run with the package root as cwd, so repo-relative paths match the real tree when invoked that way
- This repo can surface multiple `lint-staged` configs (root and `_templates/package.json`); grouped tasks follow the nearest config per staged file
