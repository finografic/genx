# @finografic/genx — Handoff

> **How to maintain this file**
> Update after sessions that change architecture, add/remove features, resolve open questions, or shift priorities — not every session.
> — Update only the sections that changed. Keep the total under 150 lines.
> — Write in present tense. No code snippets — describe what exists, not how it works.
> — `.claude/memory.md` = session work log. `.ai/handoff.md` = project state snapshot. Never duplicate between the two.

📅 Apr 24, 2026

## Project

`@finografic/genx` — Opinionated generator and codemod toolkit for the @finografic ecosystem.
Current version **v5.8.0**.

## Architecture

**CLI:** `src/cli.ts` routes to `src/commands/<cmd>.cli.ts` (create, features, migrate, deps, help).

**Create path:** command → `src/utils/prompts.ts` (orchestrator) → `src/lib/prompts/*.prompt.ts`
→ `src/utils/flow.utils.ts` (flag-aware helpers: `createFlowContext`, gated `prompt*`).

**Features:** Self-contained modules under `src/features/` (`detect`, `apply`, `*.preview.ts`, `*.feature.ts`).
`_templates/` contains output-only scaffolding for generated packages. `migrate` syncs template
conventions into existing packages.

**`src/core/`:** Only `core/self-update/` remains (genx-specific). All other core modules deleted
— callers import from `@finografic/cli-kit` subpaths.

**`src/lib/markdown-sections/`:** H2-delimited section parser/mutator for structured markdown files.
**`src/lib/feature-preview/`:** Preview/change-set infrastructure for diff-as-detection — features
compute owned file changes first, then share that result for both `detect()` and `apply()`.

**Deps command:** `src/commands/deps.cli.ts` — syncs devDependencies against `@finografic/deps-policy`.
Dry-run by default; `--write` applies + runs `pnpm install`.

## Skills

`.github/skills/` — agent-invocable skill docs. Each skill folder contains a `SKILL.md`.

| Skill folder                 | Purpose                                            |
| ---------------------------- | -------------------------------------------------- |
| `generate-new-genx-feature/` | Scaffold a new feature module for genx itself      |
| `scaffold-feature-preview/`  | Add diff-as-detection preview pattern to a feature |
| `scaffold-cli-help/`         | Add typed help config to a command                 |
| `scaffold-core-module/`      | Scaffold a new `src/lib/` module                   |
| `maintain-agents/`           | Maintain AGENTS.md and instructions                |
| `migrate-to-cli-kit/`        | Migrate a project from src/core/ to cli-kit        |
| `template-canonical-merge/`  | Merge \_templates canonical updates into a target  |
| `triage-docs/`               | Triage design artifacts in docs/scratch/           |

`generate-new-genx-feature/` also contains `new-feature.ts` (the interactive scaffold script,
run via `pnpm dev:feature`) and `feature-template/` (the `.ts.template` source files).
`_templates/` is for generated package output only — feature scaffold templates do not belong there.

## Stack

- TypeScript (strict, ESM), **tsdown** → `dist/`
- **@finografic/cli-kit** — shared CLI primitives (`/flow`, `/render-help`, `/file-diff`, `/xdg`)
- **@clack/prompts**, **@finografic/core**, **execa**, **zod** (validation)
- **@finografic/deps-policy** — canonical dep version source (`src/config/dependencies.rules.ts`)
- **vitest** (tests), **oxlint** + **oxfmt** (lint/format), **picocolors** (output)
- Path aliases: `utils/*`, `config/*`, `lib/*`, `features/*`, `types/*` (no `core/*`)
- `tsconfig.json` and `tsconfig.scripts.json` both include `.github/skills/**/*.ts`

## Key Decisions (recent)

25. **cli-kit Phase 1 complete** (2026-04-20): `src/core/flow/`, `src/core/render-help/`,
    `src/core/file-diff/` deleted. Phase 2 (features injecting cli-kit into generated/migrated
    projects) tracked in `docs/todo/TODO_MIGRATE_TO_CLI_KIT.md`.
26. **`_templates/` is output-only** (2026-04-24): `feature/` scaffold templates moved out of
    `_templates/` and into `.github/skills/generate-new-genx-feature/feature-template/`.
    `create.cli.ts` ignores `feature` in copy scope as a safety net.
27. **Skill folder renamed** (2026-04-24): `scaffold-feature/` → `generate-new-genx-feature/`;
    `scripts/new-feature.ts` → `generate-new-genx-feature/new-feature.ts`. `dev:feature` script
    in `package.json` updated to new path.
28. **`genx create` — `feature/` folder leak fixed** (2026-04-24): Generated packages were
    incorrectly receiving a `feature/` folder from genx's template copy. Root cause: `feature/`
    was inside `_templates/` and wasn't excluded. Fixed by moving templates out and adding
    `'feature'` to the unconditional ignore list in `create.cli.ts`.

## Open Questions

1. **`initialValue` for `promptText`** — author/scope fields are placeholders, not pre-filled.
2. **Author URL cancel** — could use `cancelBehavior: 'skip'` instead of full flow exit.
3. **flow defs for `features`/`migrate`** — only `{ y }` registered; other flags not wired.
4. **`genx create` version pinning** — `_templates/package.json` has hardcoded versions.
   Should `genx create` call `resolvePolicy()` at scaffold time? (see `ROADMAP.md` #1)
5. **`genx:type:*` keywords** — write-once metadata, never read back by genx at runtime.

## Status

Build: clean. Features use preview-driven detect/apply across `oxfmt`, `markdown`, `git-hooks`,
`vitest`, `ai-agents`, `ai-claude`, `ai-instructions`, and `css`.

**cli-kit Phase 2 pending:** features that scaffold/migrate other CLI projects should inject
`@finografic/cli-kit` as a dep instead of copying `src/core/` files.
Tracked in `docs/todo/TODO_MIGRATE_TO_CLI_KIT.md`.

**Roadmap:** `docs/todo/ROADMAP.md` (renamed from `TODO.ROADMAP.md`). Items 1, 2, 4, 5, 6 pending.
