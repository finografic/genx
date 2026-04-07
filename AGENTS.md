# AGENTS.md — AI Assistant Guide

## Skills — Check Before Implementing

IMPORTANT: Before writing code for any of the patterns below, invoke the paired skill.
Skills encode the exact conventions and wiring steps for this repo — skipping them causes pattern drift.

| Task                                   | Skill to invoke                                                       |
| -------------------------------------- | --------------------------------------------------------------------- |
| Add or update CLI help / add a command | [scaffold-cli-help](/.github/skills/scaffold-cli-help/SKILL.md)       |
| Add a new genx feature module          | [scaffold-feature](/.github/skills/scaffold-feature/SKILL.md)         |
| Add a new `src/core/` module           | [scaffold-core-module](/.github/skills/scaffold-core-module/SKILL.md) |
| Prune Learned sections in AGENTS.md    | [maintain-agents](/.github/skills/maintain-agents/SKILL.md)           |

---

## Rules — Project-Specific

Project-specific rules live in `.github/instructions/project/**/*.instructions.md`.
These rules are specific to `@finografic/genx` and not shared with other projects.

- **`docs/spec/CLI_CORE.md`** is the canonical **CLI `src/core/` module spec** for `@finografic` CLI packages.
  - Use it when designing portable `core/` modules, help patterns, and when generating or migrating **CLI-shaped** projects so generated trees include the same conventions (see `create` / `migrate`.
  - **library** and **config** package types do not use this `core/` layout — TBD whether they get an analogous doc).
- After editing `docs/spec/CLI_CORE.md`, copy it to `_templates/docs/spec/CLI_CORE.md` so the template stays aligned — `pnpm check:cli-core-spec` (in `release:check` and CI) compares the two files

### Generating Documentation

- Generated README sections are managed by `pnpm docs:usage` — never edit content between `<!-- GENERATED:*:START/END -->` markers by hand.
- When adding a command, use the **[scaffold-cli-help](/.github/skills/scaffold-cli-help/SKILL.md)** skill.
  It covers wiring `src/cli.ts`, `src/cli.help.ts`, and the per-command help file.
- IMPORTANT: After any change to commands, help text, or examples, run `pnpm docs:usage` to regenerate the README — never edit content between `<!-- GENERATED:*:START/END -->` markers by hand.

### Instructions to Skills Map

Canonical patterns live under `.github/instructions/project/`. Paired **skills** (agent procedures) live under `.github/skills/<name>/SKILL.md` so Cursor, Copilot, and Claude Code can discover the same workflows without relying on `.claude/skills/` only.

| Instructions                                                                               | Skill (procedure)                                                     |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| [Feature Patterns](/.github/instructions/project/feature-patterns.instructions.md)         | [scaffold-feature](/.github/skills/scaffold-feature/SKILL.md)         |
| [CLI Help Patterns](/.github/instructions/project/cli-help-patterns.instructions.md)       | [scaffold-cli-help](/.github/skills/scaffold-cli-help/SKILL.md)       |
| [Core Module Patterns](/.github/instructions/project/core-module-patterns.instructions.md) | [scaffold-core-module](/.github/skills/scaffold-core-module/SKILL.md) |

- Published to GitHub Packages (`https://npm.pkg.github.com`).
- Do not reference `@workspace/*` — all imports and deps must use published package names.

## Rules — General

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

## Rules — Markdown Tables

- Padded pipes: one space on each side of every `|`, including the separator row.
- Align column widths so all cells in the same column are equal width.

## Rules — Markdown Links

- Use markdown link syntax when referencing another document — not bare paths or backtick references.
- Use absolute paths from the repo root (e.g. `[AGENTS.md](/AGENTS.md)`).
- Prefer em-dash `—` over hyphen-minus `-` as a heading separator — it produces a cleaner `--` slug.

### Anchor slugification

When linking to a specific section, append `#<slug>` to the path:

- Use a single `#` regardless of the target heading level (H1–H6).
- Slugify: lowercase, strip characters that are not alphanumeric, spaces, or hyphens; convert spaces to hyphens.
- **Em-dash `—`** is stripped; surrounding spaces become hyphens → `--`
  - `## Skills — Check Before Implementing` → `#skills--check-before-implementing`
- **Hyphen-minus `-`** is kept; surrounding spaces also become hyphens → `---`
  - `## Rules - General` → `#rules---general`

### Confirm before writing

Before writing any link:

1. Verify the target file exists.
2. For anchor links: read the file, find the exact heading text, derive the slug — do not guess.

---

## Git Policy

- IMPORTANT: NEVER include `Co-Authored-By` lines in commit messages. Not ever, not for any reason.
- [Git — Commits](/.github/instructions/10-git-policy.instructions.md#commits)
- [Git — Releases](/.github/instructions/10-git-policy.instructions.md#releases)

---

## Learned User Preferences

- For `clack.select`, after cancel checks use explicit `choice === 'apply' || choice === 'skip'` (or equivalent) so the return type narrows to the expected union instead of `string`
- For Clack `text` validators, normalize once with `const trimmed = value?.trim() ?? ''`, require non-empty `trimmed`, then run regex tests on `trimmed` (covers undefined and satisfies narrowing)
- When using the shared ESLint stack, keep `@finografic/eslint-config` as a devDependency alongside ESLint
- Prefer `:` segment separators in `package.json` `scripts` keys and in docs (e.g. `lint:fix`, `dev:feature`); align with `_templates/package.json` rather than dot-separated names
- For feature/migrate apply output, use `successMessage` for net-new work, `successUpdatedMessage` for in-place edits (prefer “Updated …”), `successRemovedMessage` for removals — see `.github/instructions/project/feature-patterns.instructions.md` and `prompts.utils`

## Learned Workspace Facts

- Oxfmt lint-staged: canonical data glob is `*.{json,jsonc,yml,yaml,toml}` (no `md`); `*.md` runs oxfmt then `eslint --fix`; the oxfmt feature also removes `eslint-plugin-simple-import-sort` from package.json and strips its rules from `eslint.config.*`
- VS Code settings writers (oxfmt, markdown, css, dprint cleanup) use JSONC-preserving edits and normalize `markdownlint.config` / `markdown.styles` to the last two root keys when present so existing `//` comments are not stripped
- The `create` command copies `_templates/` with relative paths preserved into the new package; extra directory tiers (e.g. `root/`) land under those names in the target unless copy logic is changed
- This repo can surface multiple `lint-staged` configs (root and `_templates/package.json`); grouped tasks follow the nearest config per staged file
- `_templates/feature/` scaffold files are named `__FOLDER_NAME__.*.ts.template`; `scripts/new-feature.ts` strips the `.template` suffix when generating real files under `src/features/<name>/`
- Commitlint is configured via root `commitlint.config.mjs` (template under `_templates/`); the git-hooks feature strips a legacy top-level `commitlint` key from `package.json` when present and ensures the config file exists — `detectGitHooks` / `isGitHooksFullyConfigured` treat lint-staged and commitlint independently so a correct `lint-staged` block alone does not skip migrating inlined commitlint to the file
- `~/.config/genx/config.json` is read with `parseJsoncObject` (JSON or JSONC) for the managed-repos list
- `pnpm list:managed-repos` runs `scripts/list-managed-repos.ts` to print prettified `{ "managed": [{ name, path }, ...] }` for immediate child folders under cwd that have `package.json`, `.git`, and a `name` starting with `@finografic/`
