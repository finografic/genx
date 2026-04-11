# AGENTS.md — AI Assistant Guide

## Skills — Check Before Implementing

IMPORTANT: Before writing code for any of the patterns below, invoke the paired skill.
Skills encode the exact conventions and wiring steps for this repo — skipping them causes pattern drift.

| Task                                   | Skill to invoke                                                               |
| -------------------------------------- | ----------------------------------------------------------------------------- |
| Add or update CLI help / add a command | [scaffold-cli-help](/.github/skills/scaffold-cli-help/SKILL.md)               |
| Add a new genx feature module          | [scaffold-feature](/.github/skills/scaffold-feature/SKILL.md)                 |
| Convert a feature to preview diffs     | [scaffold-feature-preview](/.github/skills/scaffold-feature-preview/SKILL.md) |
| Add a new `src/core/` module           | [scaffold-core-module](/.github/skills/scaffold-core-module/SKILL.md)         |
| Prune Learned sections in AGENTS.md    | [maintain-agents](/.github/skills/maintain-agents/SKILL.md)                   |

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

Canonical patterns live under `.github/instructions/project/`. Paired skills live under `.github/skills/<name>/SKILL.md` so Cursor, Copilot, and Claude Code can discover the same workflows.

| Instructions                                                        | Skill (procedure)                              |
| ------------------------------------------------------------------- | ---------------------------------------------- |
| `.github/instructions/project/feature-patterns.instructions.md`     | `.github/skills/scaffold-feature/SKILL.md`     |
| `.github/instructions/project/cli-help-patterns.instructions.md`    | `.github/skills/scaffold-cli-help/SKILL.md`    |
| `.github/instructions/project/core-module-patterns.instructions.md` | `.github/skills/scaffold-core-module/SKILL.md` |

- Published to GitHub Packages (`https://npm.pkg.github.com`).
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
- Design Spec Documentation: `.github/instructions/12-design-specs.instructions.md`

## Rules — Markdown Tables

- Padded pipes: one space on each side of every `|`, including the separator row.
- Align column widths so all cells in the same column are equal width.

---

## Git Policy

- IMPORTANT: NEVER include `Co-Authored-By` lines in commit messages. Non-negotiable.
- `.github/instructions/10-git-policy.instructions.md` (see Commits and Releases sections)

---

## Learned User Preferences

- For `clack.select`, after cancel checks use explicit `choice === 'apply' || choice === 'skip'` (or equivalent) so the return type narrows to the expected union instead of `string`
- For Clack `text` validators, normalize once with `const trimmed = value?.trim() ?? ''`, require non-empty `trimmed`, then run regex tests on `trimmed` (covers undefined and satisfies narrowing)
- When using the shared ESLint stack, keep `@finografic/eslint-config` as a devDependency alongside ESLint
- Prefer `:` segment separators in `package.json` `scripts` keys and in docs (e.g. `lint:fix`, `dev:feature`); align with `_templates/package.json` rather than dot-separated names
- For feature/migrate apply output, use `successMessage` for net-new work, `successUpdatedMessage` for in-place edits (prefer “Updated …”), `successRemovedMessage` for removals — see `.github/instructions/project/feature-patterns.instructions.md` and `prompts.utils`
- For migrate/feature flows that confirm file changes, prefer one user decision per changed file (not per hunk); avoid implicit auto-accept on small diffs unless that behavior is explicitly opt-in
- Keep shared utilities for feature preview / diff-as-detection that are not canonical `src/core/` grouped in a dedicated app-level folder so they stay maintainable and can be extracted to a package later if needed

## Learned Workspace Facts

- Oxfmt lint-staged: canonical data glob is `*.{json,jsonc,yml,yaml,toml}` (no `md`); `*.md` runs oxfmt then `eslint --fix`; the oxfmt feature also removes `eslint-plugin-simple-import-sort` from package.json and strips its rules from `eslint.config.*`
- VS Code settings writers (oxfmt, markdown, css, dprint cleanup) use JSONC-preserving edits and normalize `markdownlint.config` / `markdown.styles` to the last two root keys when present so existing `//` comments are not stripped
- The `create` command copies `_templates/` with relative paths preserved into the new package; extra directory tiers (e.g. `root/`) land under those names in the target unless copy logic is changed
- This repo can surface multiple `lint-staged` configs (root and `_templates/package.json`); grouped tasks follow the nearest config per staged file
- `_templates/feature/` scaffold files are named `__FOLDER_NAME__.*.ts.template`; `scripts/new-feature.ts` strips the `.template` suffix when generating real files under `src/features/<name>/`
- Commitlint is configured via root `commitlint.config.mjs` (template under `_templates/`); the git-hooks feature strips a legacy top-level `commitlint` key from `package.json` when present and ensures the config file exists — `detectGitHooks` / `isGitHooksFullyConfigured` treat lint-staged and commitlint independently so a correct `lint-staged` block alone does not skip migrating inlined commitlint to the file
- `~/.config/genx/config.json` is read with `parseJsoncObject` (JSON or JSONC) for the managed-repos list
- `pnpm list:managed-repos` runs `scripts/list-managed-repos.ts` to print prettified `{ "managed": [{ name, path }, ...] }` for immediate child folders under cwd that have `package.json`, `.git`, and a `name` starting with `@finografic/`
- `eslint.config` writers must support `globalIgnores([...])` as well as legacy `ignores: [...]`; this repo intentionally ignores `.cursor/hooks/**` and `.cursor/chats/**` while keeping `.cursor/rules/**` lintable
- `genx deps` dependency planning uses semver: skip when the local spec already satisfies the policy range; omit policy downgrades unless `--allow-downgrade`; dry-run uses `[upgrade]` in cyan, `[add]` in green, and `[downgrade]` in yellowions after the label are white (grey “from” on upgrade/downgrade rows)
- Oxfmt `quoteProps` accepts `as-needed`, `consistent`, or `preserve` — not ESLint’s `consistent-as-needed`; align ESLint `quote-props` with an oxfmt-supported mode to avoid formatter vs lint fights on save
