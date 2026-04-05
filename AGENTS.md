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
These rules are specific to `@finografic/genx` and not shared with other projects.

<!-- NOTE: @finografic/genx only -->

- **`docs/spec/CLI_CORE.md`** is the canonical **CLI `src/core/` module spec** for `@finografic` CLI packages. Use it when designing portable `core/` modules, help patterns, and when generating or migrating **CLI-shaped** projects so generated trees include the same conventions (see `create` / `migrate`; library and config package types do not use this `core/` layout — TBD whether they get an analogous doc).
- Generated README sections are managed by `pnpm docs:usage` — never edit content between `<!-- GENERATED:*:START/END -->` markers by hand.
- When adding a command, update the `commands` array in `src/[binary].help.ts` and add a matching entry to the `EXAMPLES` section.

### Instructions ↔ skills (repo-local)

Canonical patterns live under `.github/instructions/project/`. Paired **skills** (agent procedures) live under `.github/skills/<name>/SKILL.md` so Cursor, Copilot, and Claude Code can discover the same workflows without relying on `.claude/skills/` only.

| Instructions                                                                               | Skill (procedure)                                                     |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| [Feature Patterns](/.github/instructions/project/feature-patterns.instructions.md)         | [scaffold-feature](/.github/skills/scaffold-feature/SKILL.md)         |
| [CLI Help Patterns](/.github/instructions/project/cli-help-patterns.instructions.md)       | [scaffold-cli-help](/.github/skills/scaffold-cli-help/SKILL.md)       |
| [Core Module Patterns](/.github/instructions/project/core-module-patterns.instructions.md) | [scaffold-core-module](/.github/skills/scaffold-core-module/SKILL.md) |

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

- For Clack `text` validators, normalize once with `const trimmed = value?.trim() ?? ''`, require non-empty `trimmed`, then run regex tests on `trimmed` (covers undefined and satisfies narrowing)
- For complex `pnpm-lock.yaml` conflicts, resolve `package.json` first, then run `pnpm install` to regenerate the lockfile instead of hand-merging
- When using the shared ESLint stack, keep `@finografic/eslint-config` as a devDependency alongside ESLint

## Learned Workspace Facts

- After editing `docs/spec/CLI_CORE.md`, copy it to `_templates/docs/spec/CLI_CORE.md` so the template stays aligned — `pnpm check:cli-core-spec` (in `release:check` and CI) compares the two files
- VS Code settings writers (oxfmt, markdown, css, dprint cleanup) use JSONC-preserving edits and normalize `markdownlint.config` / `markdown.styles` to the last two root keys when present so existing `//` comments are not stripped
- Cursor loads rules under `.cursor/rules/` recursively, including nested folders; mixed flat-plus-subfolder layouts are a known pain point in multi-root workspaces
- The `create` command copies `_templates/` with relative paths preserved into the new package; extra directory tiers (e.g. `root/`) land under those names in the target unless copy logic is changed
- `path.resolve('src/...', …)` in scripts follows the process cwd; pnpm/npm scripts run with the package root as cwd, so repo-relative paths match the real tree when invoked that way
- This repo can surface multiple `lint-staged` configs (root and `_templates/package.json`); grouped tasks follow the nearest config per staged file
- `_templates/feature/` scaffold files are named `__FOLDER_NAME__.*.ts.template`; `scripts/new-feature.ts` strips the `.template` suffix when generating real files under `src/features/<name>/`
- Default formatting for genx and generated scaffolds is `oxfmt` with `@finografic/oxfmt-config`; the `oxfmt` feature is for migrating existing packages (e.g. from Prettier or older setups)
- `.cursor/` is gitignored except `.cursor/rules/`; hook state and files like `mcp.json` stay untracked unless force-added or you add a narrower un-ignore for team sharing
