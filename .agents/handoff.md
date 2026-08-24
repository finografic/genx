# @finografic/genx — Handoff

> **How to maintain this file**
> Current-state snapshot, read at the start of a session. Update after sessions that change architecture, add or remove features, resolve open questions, or shift priorities — not every session.
> — **Do not duplicate content held elsewhere.** Specs, plans, TODO/DONE docs, commits and diffs are referenced by path, never summarised here.
> — **Do not record derivable facts.** No version numbers, no dates, no counts — they go stale silently and nothing forces them current. Derive them when needed.
> — Write in present tense. Describe what exists, not how it works. No code snippets.
> — Budgets: Architecture ≤ 60 lines, Key Decisions ≤ 15 items, every other section ≤ 20 lines. **When a section is over budget, cut detail before you cut items** — losing an entry is worse than losing its explanation. An Architecture entry needing more than ~5 lines has outgrown this file: write a spec and leave a pointer.
> — Retire Key Decisions once they are no longer questioned, or are already stated in `AGENTS.md`.
> — Tag every Open Work item with exactly one of `[in flight <branch>]`, `[verified, uncommitted]`, `[open PR #N]`, `[planned, not started]`, `[blocked: <what>]`. An untagged item is not done — so tag it.
> — Redact secrets, tokens, and personal data. This file is tracked in git.
> — `.agents/memory.md` = chronological working memory / session log. `.agents/handoff.md` = current project state snapshot. See `docs/process/PROJECT_MEMORY_MODEL.md`.

## Capsule

- An opinionated generator and codemod toolkit for the `@finografic` ecosystem, applied across ~20
  managed repos.
- `create`, `upgrade`, `deps`, `managed`, and `audit` are the public commands; features are internal.
- `_templates/` is the only canonical source for generated content.
- Monorepo generation is complete and verified end to end; operation scoping is the open design work.
- Shared skills are installed by the Agent Skills CLI, not vendored; `skills-lock.json` hands a
  repository's skills to it entirely.
- `upgrade` operations all preview and confirm, and no blanket writer overwrites a key its owning
  feature already writes.

## Architecture

**CLI:** `src/cli.ts` exposes `create`, `upgrade`, `deps`, `managed`, and `audit`. Feature
application is internal infrastructure, not a public command. `managed` subcommands are `upgrade`,
`deps`, `audit`, and `status`.

**Managed status:** `genx managed status` reads every managed worktree in parallel, offers a
multi-select of dirty targets only, then walks them one at a time with an AI-drafted commit message
for accept-or-regenerate. Drafts come from a local Ollama model via `src/lib/ai/`, generated
read-only and preloaded so the next message is ready while the current prompt is on screen; every
failure path returns null and falls back to manual entry.

**Prompt styling:** `src/lib/prompts/styled-multiselect.prompt.ts` exists because clack's own
`multiselect` hardcodes its label styler and exposes no hook.

**Templates:** `_templates/` is the only canonical source for generated target content.
Package-type overlays live under `_templates/package-types/`. `templates:policy:check` and
`templates:cli-core:check` fail when the template copies drift; both run in `release:check`.

**Upgrade operations:** seven, all uniform — each previews, shows a diff, and waits; a file already
matching the template produces no output. `merges` covers `package.json` only and is not offered
separately: it rides with `package-json`. There is no `--only` flag. `-y` seeds the shared confirm
state, so it reaches operations and features alike. Ownership is the rule that keeps them honest —
an operation may add what is missing, never overwrite what a feature or the project already wrote.
Reference: `docs/specs/2026-08-24-upgrade-integrity.md`.

**Package types:** `library`, `cli`, `config`, and `react`. Package-type inference is centralized
in `src/lib/package-type.utils.ts`; explicit `genx:type:*` keywords win over heuristics.

**Monorepo generation:** `genx create monorepo` clones the `monorepo-starter` repository at a
resolved tag — not `_templates/`, and not a fifth package type; a monorepo root is a workspace kind,
orthogonal to package type. Only documentation/agent features apply, because toolchain config is the
starter's own, kept current by re-tagging the starter rather than re-deriving it per generation. A
cloned tag is the only source: local-checkout generation leaked `.env.*` and the dev database, and
was removed. Reference: `docs/process/MONOREPO_GENERATION.md`.

**Workspace-aware upgrade:** against a monorepo root, `upgrade` partitions selected features into
root (doc/agent), member (`vitest`, `css`, `reactVite`), and blocked (starter-owned toolchain).
Detection requires a non-empty `packages:` list in `pnpm-workspace.yaml` — since pnpm 10 a single
package may carry that file for `allowBuilds` alone. Upgrade _operations_ are not scoped this way;
see ROADMAP #11.

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

**Agent docs:** `ai-agents` owns `AGENTS.md`. `ai-instructions` owns shared Copilot, Cursor and
Claude-facing instructions under `.agents/instructions/` (`.github/copilot-instructions.md` stays a
stub — the only place Copilot itself reads from), and retires the legacy `.github/instructions/`,
carrying `project/` content across rather than losing it. `ai-memory` owns roadmap, handoff, session
memory, `.gitignore`, and the minimal `CLAUDE.md` shim; selected alone it syncs the AGENTS
memory-model block only.

**Skills:** distributed by the Agent Skills CLI, pinned and invoked by genx from `upgrade` and both
`create` commands. `universal` owns `.agents/skills/<name>` as the real copy; `claude-code` symlinks
`.claude/skills/<name>` at it — both agents are required, or the CLI writes real directories instead.
`skills-lock.json` is the gate: present means an external manager owns skills and genx writes none.
It is committed, or a fresh clone looks unmigrated. genx still dual-writes where the lockfile is
absent; that branch retires once every repository has migrated.
Reference: `docs/specs/2026-08-23-skill-distribution-model.md`.

**Single source of truth for agent content:** `@finografic/ai-agent-config` (separate repo,
published to GitHub Packages) is canonical for the instructions shared across every `@finografic`
project; `finografic/ai-skills` is canonical for shared skills. genx is simultaneously the tool that
vendors this content into other projects _and_ a consumer of it for its own root.
`genx upgrade --agent-docs -y` (wrapped by `pnpm run update:ai-agent-config`) is the non-interactive
sync path. Note it does **not** cover legacy retirement: that belongs to the owning feature and runs
on an ordinary upgrade, because the standalone migration was unreachable from the normal flow.

## Feature Status

Every feature in `src/features/` has had a manual audit installation pass. `genx audit` starts with
nothing selected, keeps metadata visible for unchecked rows, shows installed rows as disabled green
`ok — config up to date`, and commits each applied feature separately.

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
11. One canonical copy plus symlinks, never two real copies. Two real copies of identical content is
    a bug generator — it produced an md-lint CI failure by classifying the two paths differently.
12. Genx-dev-only skills (`generate-new-genx-feature`, `migrate-to-cli-kit`,
    `scaffold-feature-preview`, `template-canonical-merge`) stay root-only permanently, never
    distributed via `ai-agent-config`. `triage-docs` was the one exception and is now portable — it
    ships as a bin in `@finografic/project-scripts`, so the skill only wraps a `pnpm dlx` call.
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
    `REACT_DEV_DEPS` is the outstanding exception; it is ROADMAP #10.
18. The feature that owns a file owns its migration and its maintenance. A blanket writer may add
    what is missing; it may never overwrite what a feature or the project already wrote. Section
    placement, ownership tables and migrations are derived from `_templates/`, not restated.
19. A preview reasons about proposed state, not only disk state. Guarding on a directory the same
    run is about to create makes the guard false exactly when the code is needed.
20. Correctness claims about genx come from running it against a real repository. Every defect in
    the 2026-08-19 and 2026-08-24 passes was invisible to a green test suite.

## Open Work

`docs/todo/ROADMAP.md` is canonical for items and priorities. What it does not make obvious:

- ROADMAP #10 (`REACT_DEV_DEPS` drift) is the smallest P1 and the last live instance of Key Decision
  17 — genx scaffolds React versions already behind the starter. `[planned, not started]`
- ROADMAP #11 is the substantive remainder of monorepo work — `upgrade` scopes features but never
  scoped operations, and the 2026-08-24 pass made operations do _more_ without scoping them. Design
  in `docs/specs/2026-08-19-workspace-ownership-model.md`, whose scope-as-a-set decision should land
  **before** the recursive `AGENTS.md` work. `[planned, not started]`
- Migrating the remaining managed repositories to the skills CLI gates nothing and needs no genx
  change; the dual-write branch retires only once that count reaches zero. `[planned, not started]`
- This file's Architecture section is over its 60-line budget and needs a prune pass, promoting
  subsystems to specs. `[planned, not started]`

Open in other repos, tracked in each:

- `@finografic/react` has no consumers; `touch-monorepo` carries drifted vendored copies of
  `useBoundingRect` / `useKeyPress`. `[blocked: no consumer to validate against]`
- `monorepo-starter` has a pre-existing MD012 error in `docs/todo/ROADMAP.md`. `[planned, not started]`
- `plate-editor`, `react`, and `zustand-context-creator` lack `.markdownlint.jsonc`, but have no
  `md-lint` wired, so nothing fails yet. `[planned, not started]`

## Next Move

ROADMAP #10 (`REACT_DEV_DEPS` drift check) — smallest P1, self-contained, and the last place genx
still ships a duplicated value with nothing forcing it current. Then #4 (`design-docs`).

## Suggested Skills

- `generate-new-genx-feature` — for #4, before writing any feature module
- `template-canonical-merge` — whenever content flows into a target from `_templates/`
- `scaffold-feature-preview` — if a feature still hand-writes detection

## References

- Roadmap: `docs/todo/ROADMAP.md`
- Near-term work: `docs/todo/ROADMAP.md#next`
- Design specs: `docs/specs/`
- Memory model: `docs/process/PROJECT_MEMORY_MODEL.md`
- Future memory skill: `docs/todo/TODO_MAINTAIN_PROJECT_MEMORY_SKILL.md`
