# AGENTS.md — AI Assistant Guide

## Roadmap and Planning Docs

**`docs/todo/ROADMAP.md` is the primary high-level plan for this project.**
**`docs/todo/NEXT_STEPS.md` is the near-term working list** — small tasks, fixes, and manual testing checklists too small for ROADMAP.

- Before proposing or generating new features, check the roadmap for existing items.
- When conceiving a new feature or initiative, add it to the appropriate priority tier.
- Detailed planning docs live alongside in `docs/todo/` as `TODO_*.md` (active) or `DONE_*.md` (complete).
- **TODO/DONE doc conventions:** `.github/instructions/documentation/todo-done-docs.instructions.md`
  — rules for naming, status headers, checkboxes, and graduating `TODO_` → `DONE_`.

---

## IMPORTANT: Canonical Template Source (STRICT)

THIS project @finografic/genx, that creates / migrates features to other projects.

- TARGET PROJECT uses `_templates/` as ONLY source of truth for:
  - scaffolding
  - merging
  - generation

- Files OUTSIDE of `_templates/` MUST NEVER be used for:
  - template content
  - structure
  - ordering

- This includes:
  - this file (root AGENTS.md)
  - feature READMEs
  - docs/\*\*

This file defines genx behavior, NOT template content.

## Skills — Check Before Implementing

IMPORTANT: Before writing code for any of the patterns below, invoke the paired skill.
Skills encode the exact conventions and wiring steps for this repo — skipping them causes pattern drift.

| Task                                           | Skill to invoke                                                              |
| ---------------------------------------------- | ---------------------------------------------------------------------------- |
| Add or update CLI help / add a command         | [scaffold-cli-help](.github/skills/scaffold-cli-help/SKILL.md)               |
| Add a new genx feature module                  | [scaffold-feature](.github/skills/scaffold-feature/SKILL.md)                 |
| Convert a feature to preview diffs             | [scaffold-feature-preview](.github/skills/scaffold-feature-preview/SKILL.md) |
| Add a new `src/core/` module                   | [scaffold-core-module](.github/skills/scaffold-core-module/SKILL.md)         |
| Template-only merge & section order            | [template-canonical-merge](.github/skills/template-canonical-merge/SKILL.md) |
| Prune Learned sections in AGENTS.md            | [maintain-agents](.github/skills/maintain-agents/SKILL.md)                   |
| Migrate a CLI project to `@finografic/cli-kit` | [migrate-to-cli-kit](.github/skills/migrate-to-cli-kit/SKILL.md)             |

---

## Rules — Project-Specific

- Project-specific rules live in `.github/instructions/project/**/*.instructions.md`.
- These rules are specific to `@finografic/genx` and not shared with other projects.

- **`docs/TEMPLATE_SOURCES_AND_AGENTS_MERGE.md`** — `_templates/` is the only spec for template merge and `AGENTS.md` spine order (not the genx root file); skill: [template-canonical-merge](/.github/skills/template-canonical-merge/SKILL.md).
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

## Rules — Global

Rules are canonical in `.github/instructions/` — see `README.md` there for folder structure.
Shared across Claude Code, Cursor, and GitHub Copilot.

**General**

- General baseline: `.github/instructions/general.instructions.md`

**Code**

- TypeScript patterns: `.github/instructions/code/typescript-patterns.instructions.md`
- Modern TS patterns: `.github/instructions/code/modern-typescript-patterns.instructions.md`
- ESLint & style: `.github/instructions/code/eslint-code-style.instructions.md`
- Provider/context patterns: `.github/instructions/code/provider-context-patterns.instructions.md`
- Picocolors CLI styling: `.github/instructions/code/picocolors-cli-styling.instructions.md`

**Naming**

- File naming: `.github/instructions/naming/file-naming.instructions.md`
- Variable naming: `.github/instructions/naming/variable-naming.instructions.md`

**Documentation**

- Documentation: `.github/instructions/documentation/documentation.instructions.md`
- README standards: `.github/instructions/documentation/readme-standards.instructions.md`
- Agent-facing markdown: `.github/instructions/documentation/agent-facing-markdown.instructions.md`
- Feature design specs: `.github/instructions/documentation/feature-design-specs.instructions.md`
- TODO/DONE docs: `.github/instructions/documentation/todo-done-docs.instructions.md`

**Git**

- Git policy: `.github/instructions/git/git-policy.instructions.md`

---

## Rules — Markdown Tables

- Padded pipes: one space on each side of every `|`, including the separator row.
- Align column widths so all cells in the same column are equal width.

---

## Git Policy

- IMPORTANT: NEVER include `Co-Authored-By` lines in commit messages. Non-negotiable.
- `.github/instructions/git/git-policy.instructions.md` (see Commits and Releases sections)

---

## Claude Code — Session Memory and Handoff

> This section applies to Claude Code only. Other agents can ignore it.

- **Session log:** `.claude/memory.md` (gitignored) — maintenance rules are in that file.
- **Project state snapshot:** `.agents/handoff.md` (git-tracked) — maintenance rules are in that file.

---

## Learned User Preferences

- For `clack.select`, after cancel checks use explicit `choice === 'apply' || choice === 'skip'` (or equivalent) so the return type narrows to the expected union instead of `string`
- For Clack `text` validators, normalize once with `const trimmed = value?.trim() ?? ''`, require non-empty `trimmed`, then run regex tests on `trimmed` (covers undefined and satisfies narrowing)
- When using the shared ESLint stack, keep `@finografic/eslint-config` as a devDependency alongside ESLint
- Prefer `:` segment separators in `package.json` `scripts` keys and in docs (e.g. `lint:fix`, `dev:feature`); align with `_templates/package.json` rather than dot-separated names
- For feature/migrate apply output, use `successMessage` for net-new work, `successUpdatedMessage` for in-place edits (prefer “Updated …”), `successRemovedMessage` for removals — see `.github/instructions/project/feature-patterns.instructions.md` and `prompts.utils`
- For migrate/feature flows that confirm file changes, prefer one user decision per changed file (not per hunk); avoid implicit auto-accept on small diffs unless that behavior is explicitly opt-in
- Keep shared utilities for feature preview / diff-as-detection that are not canonical `src/core/` grouped in a dedicated app-level folder so they stay maintainable and can be extracted to a package later if needed
- For Vitest tests, satisfy `jest/no-conditional-expect`: do not wrap follow-up `expect` calls in `if` after optional chaining; assert the value is defined and use a type predicate on `.find()` (or equivalent narrowing) before asserting on fields
- For Clack `text` prompts with a placeholder or default hint, use `textPrompt` from `core/flow` instead of `clack.text` so Tab and Right-arrow fill the hint on an empty line (upstream `@clack/core` maps Tab to backspace for tracked prompts and treats placeholder as visual-only); see `docs/spec/CLI_CORE.md`
- For Picocolors multiline dimmed output (e.g. `pc.gray`), apply the style per line and join with `\n` — a single `pc.gray(...)` on a string that contains newlines can reset after the first line so only the first row appears styled

## Learned Workspace Facts

- Oxfmt lint-staged: canonical data glob is `*.{json,jsonc,yml,yaml,toml}` (no `md`); `*.md` runs oxfmt then `eslint --fix`; the oxfmt feature also removes `eslint-plugin-simple-import-sort` from package.json and strips its rules from `eslint.config.*`
- VS Code settings writers (oxfmt, markdown, css, dprint cleanup) use JSONC-preserving edits and normalize `markdownlint.config` / `markdown.styles` to the last two root keys when present so existing `//` comments are not stripped
- The `create` command copies `_templates/` with relative paths preserved into the new package; extra directory tiers (e.g. `root/`) land under those names in the target unless copy logic is changed
- `_templates/feature/` scaffold files are named `__FOLDER_NAME__.*.ts.template`; `scripts/new-feature.ts` strips the `.template` suffix when generating real files under `src/features/<name>/`
- Commitlint is configured via root `commitlint.config.mjs` (template under `_templates/`); the git-hooks feature strips a legacy top-level `commitlint` key from `package.json` when present and ensures the config file exists — `detectGitHooks` / `isGitHooksFullyConfigured` treat lint-staged and commitlint independently so a correct `lint-staged` block alone does not skip migrating inlined commitlint to the file
- `~/.config/genx/config.json` is read with `parseJsoncObject` (JSON or JSONC) for the managed-repos list
- `pnpm list:managed-repos` runs `scripts/list-managed-repos.ts` to print prettified `{ "managed": [{ name, path }, ...] }` for immediate child folders under cwd that have `package.json`, `.git`, and a `name` starting with `@finografic/`
- `eslint.config` writers must support `globalIgnores([...])` as well as legacy `ignores: [...]`; this repo intentionally ignores `.cursor/hooks/**` and `.cursor/chats/**`; markdown lint ignores `.cursor/**` and `_templates/**/*.md` (no tracked rules under `_templates/.cursor/`)
- `genx deps` dependency planning uses semver: skip when the local spec already satisfies the policy range; omit policy downgrades unless `--allow-downgrade`; dry-run uses `[upgrade]` in cyan, `[add]` in green, and `[downgrade]` in yellow; text after the label is white (grey “from” on upgrade/downgrade rows); on `--write`, after a successful `pnpm install`, the CLI logs a compact gray `name: version` list of written deps
- Oxfmt `quoteProps` accepts `as-needed`, `consistent`, or `preserve` — not ESLint’s `consistent-as-needed`; align ESLint `quote-props` with an oxfmt-supported mode to avoid formatter vs lint fights on save
- The oxfmt feature removes Prettier config files via delete preview changes (not rename to `*--backup*` siblings)
- AGENTS merge in `ai-instructions.agents.utils`: `normalizeHeadingKey` yields lowercase keys (e.g. `rules - global`); spine map lookups and section comparisons must use those normalized keys, not display titles like `Rules — Global`, or the spine map misses sections and merge output breaks
