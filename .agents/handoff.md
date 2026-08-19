# @finografic/genx — Handoff

> **How to maintain this file**
> Update after sessions that change architecture, add/remove features, resolve open questions, or shift priorities — not every session.
> — Update only the sections that changed. Keep the total under 150 lines.
> — Write in present tense. No code snippets — describe what exists, not how it works.
> — `.agents/memory.md` = chronological working memory / session log. `.agents/handoff.md` = current project state snapshot. See `docs/process/PROJECT_MEMORY_MODEL.md`.

📅 August 19, 2026

## Project

`@finografic/genx` is an opinionated generator and codemod toolkit for the `@finografic`
ecosystem. Current version: **v5.47.1**.

## Architecture

**CLI:** `src/cli.ts` exposes `create`, `upgrade`, `deps`, `managed`, and `audit`. Feature
application is internal infrastructure, not a public command. `managed` subcommands are `upgrade`,
`deps`, `audit`, and `status`.

**Managed status:** `genx managed status` reads every managed target's worktree in parallel, then
offers a multi-select of dirty targets only. Confirming walks them one at a time, showing each
target's pending files and an AI-drafted commit message for accept-or-regenerate, then committing
with `git add -A`. Drafts come from a local Ollama model and are generated read-only, ahead of
time, so the next target's message is ready while the current prompt is on screen.

**AI commit drafts:** `src/lib/ai/` holds a thin Ollama HTTP client, pure prompt/response logic, and
a preloading draft cache. Ported from `zconf message` in `~/.zshrc-config` so genx stays
self-contained. Every failure path returns null and the flow falls back to manual entry.

**Prompt styling:** `src/lib/prompts/styled-multiselect.prompt.ts` is a multi-select with per-row
state styling, built on `@clack/core`'s `MultiSelectPrompt` plus clack's exported `limitOptions`.
It exists because clack's own `multiselect` hardcodes its label styler and exposes no hook.

**Templates:** `_templates/` is the only canonical source for generated target content.
Package-type overlays live under `_templates/package-types/`. `templates:policy:check` and
`templates:cli-core:check` fail when the template copies drift; both run in `release:check`.

**Upgrade merges:** `merges` covers `package.json` only, so it is not independently selectable — it
rides with the `package-json` operation in the picker, and stays reachable via `--only merges`. It
plans only real changes, applies against disk rather than plan-time content, and confirms through
the same per-file diff as every other `package.json` writer.

**Package types:** `library`, `cli`, `config`, and `react`. Package-type inference is centralized
in `src/lib/package-type.utils.ts`; explicit `genx:type:*` keywords win over heuristics.

**Monorepo generation:** `genx create monorepo` clones the `monorepo-starter` repository at a
pinned tag — not `_templates/`, and not a fifth package type. A monorepo root is a workspace kind,
orthogonal to package type. `src/lib/monorepo/` holds clone, tag resolution, identity rewrite, and
env/database bootstrap; `src/config/monorepo.config.ts` holds the pin and the root-feature
allowlist. Only documentation/agent features apply — toolchain config is the starter's own, kept
current by upgrading and re-tagging the starter rather than re-deriving it per generation. A cloned
tag is the only source: local-checkout generation was built, leaked `.env.*` and the dev database,
and was removed. Reference: `docs/process/MONOREPO_GENERATION.md`.

**Features:** Self-contained modules live under `src/features/`. Preview-driven change sets power
both detection and apply flows. Audit reports `installed`, `partial`, and `missing` states.

**Dependencies:** `genx deps` aligns installed target dependencies and toolchain files to the
current deps-policy snapshot. `genx deps --update-policy` refreshes only the local policy snapshot.
`genx managed deps` uses the current snapshot by default; `genx managed deps --update-policy`
refreshes the snapshot once, then syncs all managed targets against that same snapshot.

**VS Code settings:** `src/utils/vscode-settings.*` defines explicit setting groups and renders
stable JSONC ordering with blank lines between groups.

**Legacy cleanup:** `src/lib/legacy-removal.utils.ts` centralizes legacy feature associations.
`oxc-config` removes obsolete ESLint / dprint dependencies and root files, then cleans related
VS Code and CI surfaces.

**Agent docs:** `ai-agents` owns `AGENTS.md` and portable skill scaffolding, dual-written to
`.agents/skills/` (cross-tool manual reference via `AGENTS.md`) and `.claude/skills/` (native
Claude Code discovery) from one `_templates/.agents/skills/` source. `ai-instructions` owns shared
Copilot, Cursor, and Claude-facing instructions under `.agents/instructions/`
(`.github/copilot-instructions.md` stays a stub — only place Copilot itself reads from). `ai-memory`
owns roadmap, handoff, session memory, `.gitignore`, and the minimal `CLAUDE.md` shim. When selected
alone, `ai-memory` syncs the required AGENTS memory-model block without installing skills.

**Single source of truth for agent content:** `@finografic/ai-agent-config` (separate repo,
published to GitHub Packages) is canonical for instructions/skills shared across every
`@finografic` project. `_templates/.agents/` and genx root's own `.agents/` both pull from it —
genx is simultaneously the tool that vendors this content into other projects _and_ a consumer of
it for its own root. `genx upgrade --agent-docs -y` (wrapped by `pnpm run update:ai-agent-config`)
is the non-interactive sync path: legacy structural migration (old `.github/instructions/` →
`.agents/instructions/`, `.ai/` → `.agents/`) followed by real content diff-and-apply via the same
`applyFeaturesToTarget` helper `genx audit` uses. Applied changes auto-commit per feature.

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

`genx audit` starts with no features selected, keeps metadata visible for unchecked rows, shows
installed rows as disabled green `ok — config up to date` entries, and commits each applied feature
separately.

## Key Decisions

1. `_templates/` is output-only and canonical for generated content.
2. Baseline create features are `oxc-config` and markdown; optional selections add extras.
3. Package-specific feature behavior routes through `src/lib/package-type.utils.ts`.
4. Preview-driven diffs are the source of truth for feature detection and apply.
5. Portable skills belong to `ai-agents`, not `ai-memory`.
6. `.agents/handoff.md` is tracked stable state; `.agents/memory.md` is the gitignored session log.
7. Legacy `.claude/memory.md` and `.claude/handoff.md` are migrated, then deleted.
8. `upgrade` is the public package-convention sync command; `audit` is the public feature repair
   command.
9. Managed deps must not move deps-policy implicitly; policy refresh is explicit via
   `--update-policy`.
10. `@finografic/ai-agent-config` is the single source of truth for shared agent instructions/
    skills; genx's own `_templates/.agents/` and root `.agents/` both vendor from it, never from
    each other. Content flows outward from `ai-agent-config`, never back into it.
11. Skills dual-write to `.agents/skills/` (manual reference) and `.claude/skills/` (native Claude
    Code discovery) from one source. Instructions do not dual-write — no tool natively discovers an
    "instructions" directory the way Claude Code discovers `.claude/skills/`.
12. Genx-dev-only skills (`generate-new-genx-feature`, `migrate-to-cli-kit`,
    `scaffold-feature-preview`, `template-canonical-merge`) stay root-only permanently, never
    distributed via `ai-agent-config`. `triage-docs` is the one exception pending ROADMAP #6
    (`scripts/triage-docs.ts` portability).
13. AI commit drafts are generated read-only. Preloading runs ahead of user confirmation, so it must
    never stage or otherwise mutate a target the user may still skip.
14. `.env` in the genx package root wins over the shell environment for Ollama settings, inverting
    Node's `--env-file` precedence, so a globally exported model name cannot silently override it.
15. `@clack/core` is pinned exact to the version `@clack/prompts` pins. Two copies break `isCancel`,
    which compares a module-local symbol.
16. Every write to a target's `package.json` goes through a per-file diff confirmation. No path may
    write it on the strength of a filename list or an up-front batch prompt.
17. Values duplicated outside their source of truth need a check that fails when they drift —
    `_templates` versions, `.nvmrc`, `engines.pnpm`, and the CLI core spec copy each have one.

## Open Work

Nothing is at P0 or P1. `docs/todo/ROADMAP.md` is canonical for items and priorities; two things it
does not make obvious:

- The critical path is #6 → #4, and **#6's next move is in `@finografic/project-scripts`, not
  here** — the genx side is done, and the port is mechanical: the script keeps `@clack/prompts`,
  which that package is moving to anyway. Once the bin ships, delete `scripts/triage-docs.ts` and
  repoint the skill.
- **Monorepo generator v1** (workspace-aware upgrade) is the only substantial genx-side item both
  scoped and unblocked today.

Open in other repos, tracked in each:

- `@finografic/react` has no consumers; `touch-monorepo` carries drifted vendored copies of
  `useBoundingRect` / `useKeyPress`.
- `monorepo-starter` has a pre-existing MD012 error in `docs/todo/ROADMAP.md` (auto-fixable).
- `plate-editor`, `react`, and `zustand-context-creator` lack `.markdownlint.jsonc`, but have no
  `md-lint` wired, so nothing fails yet.

## References

- Roadmap: `docs/todo/ROADMAP.md`
- Near-term work: `docs/todo/ROADMAP.md#next`
- Memory model: `docs/process/PROJECT_MEMORY_MODEL.md`
- Future memory skill: `docs/todo/TODO_MAINTAIN_PROJECT_MEMORY_SKILL.md`
