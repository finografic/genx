# @finografic/genx — Handoff

> **How to maintain this file**
> Update after sessions that change architecture, add/remove features, resolve open questions, or shift priorities — not every session.
> — Update only the sections that changed. Keep the total under 150 lines.
> — Write in present tense. No code snippets — describe what exists, not how it works.
> — `.agents/memory.md` = chronological working memory / session log. `.agents/handoff.md` = current project state snapshot. See `docs/process/PROJECT_MEMORY_MODEL.md`.

📅 June 2, 2026

## Project

`@finografic/genx` is an opinionated generator and codemod toolkit for the `@finografic`
ecosystem. Current version: **v5.36.0**.

## Architecture

**CLI:** `src/cli.ts` routes to co-located command folders under `src/commands/`: `create`,
`migrate`, `deps`, `features`, `managed`, and `audit`.

**Templates:** `_templates/` is the only canonical source for generated target content.
Package-type overlays live under `_templates/package-types/`.

**Package types:** `library`, `cli`, `config`, and `react`. Package-type inference is centralized
in `src/lib/package-type.utils.ts`; explicit `genx:type:*` keywords win over heuristics.

**Features:** Self-contained modules live under `src/features/`. Preview-driven change sets power
both detection and apply flows. Audit reports `installed`, `partial`, and `missing` states.

**VS Code settings:** `src/utils/vscode-settings.*` defines explicit setting groups and renders
stable JSONC ordering with blank lines between groups.

**Legacy cleanup:** `src/lib/legacy-removal.utils.ts` centralizes legacy feature associations.
`oxc-config` removes obsolete ESLint / dprint dependencies and root files, then cleans related
VS Code and CI surfaces.

**Agent docs:** `ai-agents` owns `AGENTS.md` and portable skill scaffolding. `ai-instructions`
owns shared Copilot, Cursor, and Claude-facing instructions. `ai-memory` owns roadmap, next steps,
handoff, session memory, `.gitignore`, and the minimal `CLAUDE.md` shim. When selected alone,
`ai-memory` syncs the required AGENTS memory-model block without installing skills.

## Feature Status

Manual audit installation passes are complete for:

- `oxc-config`
- `react-vite`
- `ai-agents`
- `ai-instructions`
- `ai-memory`
- `git-hooks`
- `markdown`
- `css`
- `vitest`

`genx audit` starts with no features selected, keeps metadata visible for unchecked rows, and shows
installed rows as disabled green `ok — config up to date` entries.

## Key Decisions

1. `_templates/` is output-only and canonical for generated content.
2. Baseline create features are `oxc-config` and markdown; optional selections add extras.
3. Package-specific feature behavior routes through `src/lib/package-type.utils.ts`.
4. Preview-driven diffs are the source of truth for feature detection and apply.
5. Portable skills belong to `ai-agents`, not `ai-memory`.
6. `.agents/handoff.md` is tracked stable state; `.agents/memory.md` is the gitignored session log.
7. Legacy `.claude/memory.md` and `.claude/handoff.md` are migrated, then deleted.

## Open Work

- Apply policy resolution directly after `genx create` scaffolding.
- Review type-specific `deps-policy` divergence.
- Modernize the new-feature scaffold for preview-driven detect/apply.
- Review cli-kit extraction candidates tracked in `docs/todo/ROADMAP.md`.
- Add the future `maintain-project-memory` skill.

## References

- Roadmap: `docs/todo/ROADMAP.md`
- Near-term work: `docs/todo/NEXT_STEPS.md`
- Memory model: `docs/process/PROJECT_MEMORY_MODEL.md`
- Future memory skill: `docs/todo/TODO_MAINTAIN_PROJECT_MEMORY_SKILL.md`
