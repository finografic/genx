# AGENTS.md — AI Assistant Guide

## Project Memory Model

- `docs/todo/ROADMAP.md` = curated milestone plan + completed milestone history.
- `docs/todo/NEXT_STEPS.md` = near-term working list, manual testing, and small follow-ups.
- `.agents/handoff.md` = current project state snapshot.
- `.agents/memory.md` = chronological working memory / session log.

Promotion rule:

- session detail, partial work, and temporary context belong in `.agents/memory.md`
- stable current truth belongs in `.agents/handoff.md`
- project priorities and completed milestone-scale work belong in `ROADMAP.md`
- small actionable follow-ups and manual verification belong in `NEXT_STEPS.md`

Do not duplicate the same item across all four files unless it truly belongs in each role.

Reference: [`docs/process/PROJECT_MEMORY_MODEL.md`](./docs/process/PROJECT_MEMORY_MODEL.md)

---

## Roadmap and Planning Docs

- Before proposing or generating new features, check `ROADMAP.md` for existing priorities.
- When conceiving a new feature or initiative, add it to the appropriate roadmap tier.
- Use `NEXT_STEPS.md` for concrete follow-ups, manual validation, and small tasks that do not need full roadmap treatment.
- Detailed feature planning docs live in `docs/todo/` as `TODO_*.md` (active) or `DONE_*.md` (complete).
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
- ESLint & style: `.github/instructions/code/linting-code-style.instructions.md`
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

## Project Memory Model

- `docs/todo/ROADMAP.md` = curated milestone plan + completed milestone history.
- `docs/todo/NEXT_STEPS.md` = near-term working list, manual testing, and small follow-ups.
- `.agents/handoff.md` = current project state snapshot.
- `.agents/memory.md` = chronological working memory / session log.

Promotion rule:

- session detail, partial work, and temporary context belong in `.agents/memory.md`
- stable current truth belongs in `.agents/handoff.md`
- project priorities and completed milestone-scale work belong in `ROADMAP.md`
- small actionable follow-ups and manual verification belong in `NEXT_STEPS.md`

Do not duplicate the same item across all four files unless it truly belongs in each role.

Reference: [`docs/process/PROJECT_MEMORY_MODEL.md`](./docs/process/PROJECT_MEMORY_MODEL.md)

---

## Learned User Preferences

- For `clack.select`, after cancel checks use explicit `choice === 'apply' || choice === 'skip'` (or equivalent) so the return type narrows to the expected union instead of `string`
- For Clack `text` validators, normalize once with `const trimmed = value?.trim() ?? ''`, require non-empty `trimmed`, then run regex tests on `trimmed` (covers undefined and satisfies narrowing)
- Prefer `:` segment separators in `package.json` `scripts` keys and in docs (e.g. `lint:fix`, `dev:feature`); align with `_templates/package.json` rather than dot-separated names
- VS Code settings writers should place `editor.formatOnSaveMode`, `editor.defaultFormatter` (`oxc.oxc-vscode`), and `oxc.typeAware` before `prettier.enable`, add a `[markdown]` formatter block before `markdownlint.config`, and preserve trailing `//` comments on markdownlint rule lines when editing JSONC
- For AGENTS.md structure and planning sections: prefer front matter (INITIAL CONTEXT, Project Memory Model, Roadmap) → Rules spine → middle extras → Learned last; use **Roadmap and Planning Docs** Version B workflow bullets (not Version A) so planning guidance complements Project Memory Model without redefining file roles
- For migrate/feature flows that confirm file changes, prefer one user decision per changed file (not per hunk); avoid implicit auto-accept on small diffs unless that behavior is explicitly opt-in
- Keep shared utilities for feature preview / diff-as-detection that are not canonical `src/core/` grouped in a dedicated app-level folder so they stay maintainable and can be extracted to a package later if needed
- For Vitest tests, satisfy `jest/no-conditional-expect`: do not wrap follow-up `expect` calls in `if` after optional chaining; assert the value is defined and use a type predicate on `.find()` (or equivalent narrowing) before asserting on fields
- For Clack `text` prompts with a placeholder or default hint, use `textPrompt` from `core/flow` instead of `clack.text` so Tab and Right-arrow fill the hint on an empty line (upstream `@clack/core` maps Tab to backspace for tracked prompts and treats placeholder as visual-only); see `docs/spec/CLI_CORE.md`
- For Picocolors multiline dimmed output (e.g. `pc.gray`), apply the style per line and join with `\n` — a single `pc.gray(...)` on a string that contains newlines can reset after the first line so only the first row appears styled
- For migration-only code paths that exist solely to remove or strip legacy ESLint, Stylelint, or `@stylistic` pieces, use `// DEPRECATED: <short reason; remove when …>` (project spelling: `DEPRECATED`, not `DEPRECTATED`)
- When merging the `# Agents` block into `.gitignore`, replace that commented section in place (do not append lines after later sections such as `# Environment files`); keep canonical lines aligned with `_templates/.gitignore` or a single shared canonical helper so the section does not drift across two sources

## Learned Workspace Facts

- lint-staged (Oxc stack): code `*.{ts,tsx,js,jsx,mjs,cjs}` runs `oxfmt` then `oxlint -c oxlint.config.ts --fix` (both with `--no-error-on-unmatched-pattern`); `*.md` runs `oxfmt` then `oxlint --fix` in `_templates/` (this repo may use `md-lint --fix` on `*.md`); data `*.{json,jsonc,yml,yaml,toml}` runs `oxfmt` only; CI uses `lint:ci` (`oxlint … --quiet`); migrate/preview object spreads use `...(obj as T | undefined)` not `...((obj) ?? {})` for `unicorn/no-useless-fallback-in-spread`
- VS Code settings writers (oxc-config, markdown, css) use JSONC-preserving edits and normalize `markdownlint.configFile` / `markdown.styles` (or legacy inline `markdownlint.config`) to the end with per-line comments preserved; migrations remove legacy inline `markdownlint.config` when moving to a config file
- The `create` command copies `_templates/` with relative paths preserved into the new package (extra directory tiers such as `root/` land under those names unless copy logic changes); `_templates/feature/` scaffold files are named `__FOLDER_NAME__.*.ts.template`, and `scripts/new-feature.ts` strips the `.template` suffix when generating files under `src/features/<name>/`
- Tests for `proposeAgentsGitignoreMerge` should assert idempotency (`merge(merge(content)) === merge(content)` or equivalent) rather than byte equality to a hand-built string from `getCanonicalAgentsGitignoreLines().join('\n')`, because the merge path can normalize trailing newlines differently
- Commitlint is configured via root `commitlint.config.mjs` (template under `_templates/`); the git-hooks feature strips a legacy top-level `commitlint` key from `package.json` when present and ensures the config file exists — `detectGitHooks` / `isGitHooksFullyConfigured` treat lint-staged and commitlint independently so a correct `lint-staged` block alone does not skip migrating inlined commitlint to the file
- `~/.config/finografic/genx.config.jsonc` is the primary managed-repos config (parsed with `parseJsoncObject`); falls back to legacy `~/.config/genx/config.jsonc` with a one-time migration warning
- `create` / `migrate` no longer scaffold `eslint.config.ts`; the **`oxc-config`** feature installs `oxfmt` + `oxlint` + `@finografic/oxc-config`, removes the legacy Prettier stack, and strips `eslint-plugin-simple-import-sort`; the **css** feature conditionally patches `oxfmt.config.ts` for `css`/`scss` overrides
- `genx deps` dependency planning uses semver: skip when the local spec already satisfies the policy range; omit policy downgrades unless `--allow-downgrade`; the planned-change table uses `[upgrade]` in cyan, `[add]` in green, and `[downgrade]` in yellow; text after the label is white (grey “from” on upgrade/downgrade rows); after package selection (or `--yes`), a successful `pnpm install` logs a compact gray `name: version` list of written deps; `genx deps` also syncs toolchain versions (`.nvmrc`, `engines.node`, `packageManager`) from `@finografic/deps-policy` `toolchain` export
- Toolchain versions (node, pnpm) are sourced from `@finografic/deps-policy` `toolchain` export via `src/config/policy.ts` (XDG snapshot fallback); `genx create` writes `.nvmrc`, `engines.node`, and `packageManager` dynamically after template copy; the old `src/config/node.policy.ts` hardcoded source is deleted
- `.husky/post-commit` runs `pnpm docs:usage`, then `pnpm exec oxfmt --no-error-on-unmatched-pattern README.md`, before the docs auto-commit so CI `format:check` matches generated README output
- Project-specific JSDoc block tags (e.g. `@finografic`) are allowed in oxlint via `jsdoc/check-tag-names` with `definedTags: ['finografic']` — use the tag name without `@` in `definedTags`
- `ai-agents` and `ai-instructions` must share AGENTS.md section reorder/strip logic (`reorderAgentsMdFullTextBlocks`, strip legacy Agent Memory Files / Claude handoff, dedupe Markdown Tables) — divergent reorder paths fight and scramble section order on migrate/apply; `ai-instructions` also runs `rewriteLegacyAgentDocPaths` and spine lookups must use `normalizeHeadingKey` lowercase keys (e.g. `rules - global`), not display titles
- `ai-memory` replaces `ai-claude`; preview migrates legacy `.claude/handoff.md` into `.agents/handoff.md` when missing; memory files live under `.agents/` (`.gitignore`: `.agents/*` + `!.agents/handoff.md`)
- Multi-repo execution uses `genx managed <command>` (subcommands: `migrate`, `deps`, `features`); the shared target loop lives in `src/lib/managed/managed-loop.runner.ts` (`runManagedLoop`); `--managed` flag is kept as a deprecated compatibility alias with a warning
- The **css** feature no longer handles Stylelint — all Stylelint detection, constants, removal logic, and VSCode settings stripping were removed; it now only handles `oxfmt.config.ts` CSS/SCSS overrides
- The **oxc-config** feature no longer handles dprint cleanup — `oxc-config.dprint-cleanup.ts`, `oxc-config.workflows.ts`, and their tests were deleted; the feature no longer strips dprint from target projects
- `scripts/generate-readme-usage.ts` imports all 6 command `CommandHelpConfig` objects (which now include `options`, `examples`, and `howItWorks`) and uses a local `commandHelpToMarkdown()` converter to generate per-command README sections; the former hardcoded `COMMAND_OPTIONS` map was removed
