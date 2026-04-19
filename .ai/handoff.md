# @finografic/genx — Handoff

> **How to maintain this file**
> Update after sessions that change architecture, add/remove features, resolve open questions, or shift priorities — not every session.
> — Update only the sections that changed. Keep the total under 150 lines.
> — Write in present tense. No code snippets — describe what exists, not how it works.
> — `.claude/memory.md` = session work log. `.ai/handoff.md` = project state snapshot. Never duplicate between the two.

## Project

`@finografic/genx` — Opinionated generator and codemod toolkit for the @finografic ecosystem.
Current version **v5.4.0**.

## Architecture

**CLI:** `src/cli.ts` routes to `src/commands/<cmd>.cli.ts` (create, features, migrate, deps, help).

**Create path:** command → `src/utils/prompts.ts` (orchestrator) → `src/lib/prompts/*.prompt.ts`
→ `src/utils/flow.utils.ts` (flag-aware helpers: `createFlowContext`, gated `prompt*`).

**Features:** Self-contained modules under `src/features/` (`detect`, `apply`, `*.feature.ts`).
Templates live in `_templates/`. `migrate` syncs template conventions into existing packages.

**`src/core/`:** Portable infrastructure shared across all `@finografic` CLI repos — kept in sync
by convention. Modules: `core/flow/` (clack adapter), `core/render-help/` (CLI help renderer),
`core/file-diff/` (per-file unified diff display + write confirmation via jsdiff).

**`src/lib/markdown-sections/`:** H2-delimited section parser/mutator for structured markdown
files (AGENTS.md, CLAUDE.md). API: `parseSections`, `serializeSections`, `setSection` (upsert),
`insertSection`, `deleteSection`, `reorderSections`, `hasSection`, `getMissingHeadings`.
Foundation for the `ai-agents` feature (#8).

**`src/lib/feature-preview/`:** App-level preview/change-set infrastructure for diff-as-detection.
Features compute owned file changes first, then share that preview result for both `detect()` and
`apply()`. `applyPreviewChanges()` handles per-file confirmation, write/delete/rename-backup
operations, and reports `appliedTargetPaths` for structured post-write steps like `pnpm install`.

**Deps command:** `src/commands/deps.cli.ts` — syncs devDependencies against
`@finografic/deps-policy`. Dry-run by default; `--write` applies + runs `pnpm install`.
No features prompt, no help file logic.

## Stack

- TypeScript (strict, ESM), **tsdown** → `dist/`
- **@clack/prompts**, **@finografic/core**, **execa**, **zod** (validation)
- **@finografic/deps-policy** — canonical dep version source (`src/config/dependencies.rules.ts`)
- **diff** (jsdiff) — unified diff generation used by `core/file-diff`
- **vitest** (tests), **eslint** + **oxfmt** (lint/format)
- **picocolors** (output); path aliases: `utils/*`, `config/*`, `core/*`, `lib/*`, `features/*`, `types/*`

## Schema / Types

| Type                        | Purpose                                                                     |
| --------------------------- | --------------------------------------------------------------------------- |
| `Feature`                   | id, label, detect, apply                                                    |
| `FeatureId`                 | Union of registered feature IDs                                             |
| `FeatureContext`            | `{ targetDir }` for detect/apply                                            |
| `FeatureApplyResult`        | `{ applied[], noopMessage?, error? }`                                       |
| `TemplateVars`              | Token map for template substitution                                         |
| `PackageType`               | id, label, description, keywords, scripts, eslint, defaultFeatures          |
| `PackageManifest`           | `{ scope, name, description }`                                              |
| `Author`                    | `{ name, email, url }`                                                      |
| `PackageConfigWithFeatures` | Full create prompt output (extends `PackageConfig` from `@finografic/core`) |
| `FlowContext<F>`            | Flag-parsed context from `flow.utils.ts`                                    |
| `MigrateConfig`             | Options for migrate command                                                 |
| `DependencyRule`            | `{ package, version: string \| undefined, type, optional? }`                |

`DependencyRule.optional: true` — skip add if absent; align version only if already declared.

## CLI Commands

| Command         | Description                                                |
| --------------- | ---------------------------------------------------------- |
| `genx create`   | Scaffold a new `@finografic` package from template         |
| `genx features` | Add optional features to an existing package (interactive) |
| `genx migrate`  | Sync conventions / templates into an existing package      |
| `genx deps`     | Sync devDependencies to deps-policy (dry-run / `--write`)  |
| `genx help`     | Help (also `genx <cmd> --help`)                            |

## Decisions

1. `.ai/handoff.md` introduced as bridge between Claude Code and Claude.ai (2026-02-20)
2. Split **ai-rules** → **ai-claude** (CLAUDE.md + `.claude/`) and **ai-instructions**
   (`.github/instructions`, Copilot, Cursor) (2026-02-14)
3. **ai-claude** auto-installs **ai-instructions** if missing (2026-02-14)
4. Feature pattern is additive: detect → apply only missing pieces (2026-02-13)
5. Features can be applied during `create`, not only via `features` (2026-02-13)
6. **oxfmt** migration feature replaces Prettier — backs up Prettier configs first (2026-02-13)
7. ESLint config generated to match package type / features (2026-02-13)
8. `.claude/` gitignored globally; `!.claude/settings.json` re-admits settings (2026-02-14)
9. **`flow.utils.ts`:** Normalized across repos — each repo owns its copy (2026-03-26)
10. `create` supports `-y`, `--type <id>`, `--name <name>`; author defaults in yes-mode (2026-03-26)
11. All dep version strings removed from genx. `@finografic/deps-policy ^0.1.0` is the
    single source of truth — `dependencies.rules.ts`, `vitest.constants.ts`, etc. (2026-04-06)
12. `DependencyRule.optional: true` — used for formatter-optional deps (oxfmt,
    @finografic/oxfmt-config, @stylistic, @finografic/md-lint). (2026-04-06)
13. `version: string | undefined` preferred over `version?: string` — prevents accidental
    omission at compile time. (2026-04-06)
14. `genx deps` added as standalone command; `--only=dependencies` on migrate retained for
    granular migrate workflows. (2026-04-06)
15. `generate-readme-usage.ts` imports from `src/cli.help.ts`. After any command/help
    change: run `pnpm docs:usage`. (2026-04-06)
16. `core/file-diff` — `confirmFileWrite` wraps any string-in/string-out write with a
    coloured diff + prompt. Pass a shared `DiffConfirmState` for yes-to-all across files.
    Integrated in `migrate.cli.ts` at all `writePackageJson` sites. (2026-04-07)
17. `lib/markdown-sections` — regex lookahead split `^(?=## )` handles H2 boundaries;
    files starting with `##` (no preamble) need explicit `startsWith('## ')` check because
    JS zero-width split at position 0 emits no empty prefix. (2026-04-07)
18. `diff-as-detection` — features can own a `*.preview.ts` module that computes canonical file
    changes, with `detect()` using preview emptiness as truth and `apply()` reusing the same
    preview result. `src/lib/feature-preview/` stays outside canonical `src/core/`. (2026-04-07)
19. `ai-instructions` no longer scaffolds `.cursor/rules/`; the repo keeps `.claude/assets/.gitkeep`
    for `ai-claude`, but skips redundant Cursor rules. (2026-04-07)
20. **markdown feature** migrated from `eslint-plugin-markdownlint` to `@finografic/md-lint`
    (2026-04-09). Feature now: installs `@finografic/md-lint`, adds `lint.md`/`lint.md.fix` scripts,
    migrates lint-staged `*.md` to `md-lint --fix`, migrates `markdown.styles` in settings.json to
    `node_modules/@finografic/md-lint/styles/`, proposes deletion of old `.vscode/` CSS copies,
    and proposes a CI step. No `.markdownlint.jsonc` needed — rules are baked into the package;
    VS Code extension reads `markdownlint.config` from settings.json.
21. **oxfmt base template** no longer includes the CSS/SCSS override (2026-04-09). The css feature
    adds it when applied. `css.oxfmt.ts` already had full insert logic; template was updated to match.
22. **`genx create` README bug fixed** (2026-04-10): `applyTemplate` regex updated to match BOTH
    `__TOKEN__` and `**TOKEN**` forms — MD049 lint normalises underscore→asterisk emphasis in
    markdown text positions during commit. URL-stripping regex now matches post-substitution
    `[Name]()` (empty link) rather than searching for the literal `__AUTHOR_URL__` token.
23. **`sortedRecord()` utility added** (2026-04-10): `package-manager.utils.ts` exports
    `sortedRecord(record)` — returns a shallow copy sorted A→Z by key. All `with*DevDependency`
    helpers (markdown, vitest, css, git-hooks) now use it so written package.json keeps
    devDependencies in sorted order.
24. **Markdown self-install guard** (2026-04-10): `previewMarkdown` short-circuits with a noop
    when the target package name is `@finografic/md-lint`, preventing the feature from adding
    itself as its own devDependency.

## Open Questions

1. **`initialValue` for `promptText`** — author/scope fields are placeholders, not pre-filled.
2. **Author URL cancel** — could use `cancelBehavior: 'skip'` instead of full flow exit.
3. **flow defs for `features`/`migrate`** — only `{ y }` registered; other flags not wired.
4. **`genx create` version pinning** — `_templates/package.json` has hardcoded versions.
   Should `genx create` call `resolvePolicy()` at scaffold time? (see `TODO.ROADMAP.md` #4)
5. **`genx:type:*` keywords** — write-once metadata, never read back by genx at runtime.
   Useful for npm search / external tooling; redundant for genx's own detect/apply logic.

## Status

Core CLI and all current roadmap items up through #8 are implemented. Done: #6 (bulk `--managed`),

\# 2 (`core/file-diff` diff+confirm), \#7 (`lib/markdown-sections`), \#8 (`ai-agents`), and \#3

(`diff-as-detection` via `src/lib/feature-preview/` + feature-local previews).

Features now use preview-driven detect/apply across `oxfmt`, `markdown`, `git-hooks`, `vitest`,
`ai-agents`, `ai-claude`, `ai-instructions`, and `css`. `migrate --write` still shows per-file
diff confirmation, and feature migration work can reuse the new `scaffold-feature-preview` skill.
