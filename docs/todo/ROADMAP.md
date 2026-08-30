# genx — Roadmap

> **This is the primary high-level plan for the project.**
> Agents and contributors: check this file before proposing new work. Add new items here when
> conceiving features. Keep it ordered by priority — move items down as priorities shift, and
> move completed items to the Done section at the bottom.

---

## How to use this file

| Tier | Meaning                                   |
| ---- | ----------------------------------------- |
| P0   | Active — being worked on now              |
| P1   | Next — fully scoped, ready to start       |
| P2   | Planned — direction decided, detail TBD   |
| P3   | Backlog — good ideas, not yet prioritised |

Each item: one-line description + link to detail doc if one exists in `docs/todo/`.
When an item is done, move it to the Done section at the bottom with a completion date.

---

## Next

- **#13 `genx managed live`** — top priority once any outstanding bug fixes are clear. Fully scoped.
- **#10 `REACT_DEV_DEPS` drift check** — smallest P1, and it removes a live source of wrong output.
  Half-answered on 2026-08-30: deps-policy now has a real `react` group, so the "give `react` a
  deps-policy group" branch is taken. What remains is moving `REACT_RUNTIME_DEPS` /
  `REACT_DEV_DEPS` onto it, or adding the comparison check.
- Independent of any roadmap item: the remaining managed repositories still need
  `npx skills add finografic/ai-skills`. It gates nothing, needs no genx changes, and can happen at
  any pace — see the migration note under P3.

---

## P0 — Active

No items.

---

## P1 — Next Up

### 13. `genx managed live` — live alignment dashboard

A read-only TUI across selected managed targets, refreshed on an interval: version, last commit
date, ahead/behind, dirty files, and how many dependencies are unaligned with policy. Opens with a
multi-select whose choices are remembered in XDG cache, so a session can watch only the three or
four repos currently being worked on — including while an agent edits them.

Decided 2026-08-30 to keep `managed` inside genx rather than extract it to its own CLI: three of its
four subcommands are short loops whose body calls a genx command, and the dashboard's most valuable
column needs `dependencyRules` and `planDependencyChanges`, both genx-internal. The reasoning, the
column cost tiers, and the refresh budget are in the detail doc.

Phase 1 is genx-only and deliberately unabstracted. Extraction to `@finografic/cli-kit` (Phase 2)
and adoption in `gli` (Phase 3) are tracked in those repos and blocked on this shipping first.

Detail: [`docs/todo/TODO_MANAGED_LIVE_DASHBOARD.md`](./TODO_MANAGED_LIVE_DASHBOARD.md)

A scheduled drift report (#14) builds directly on this — the same facts, rendered as JSON.

### 10. `REACT_DEV_DEPS` has no drift check

`src/features/react-vite/react-vite.constants.ts` pins React-side versions in genx. Nothing keeps
them current, and they are already behind `monorepo-starter`, so a fresh `genx create` of a react
package scaffolds stale versions.

This is Key Decision 17 — a value duplicated with nothing forcing it current — and the 2026-08-24
integrity pass hit that same shape five separate times in one command.

Updated 2026-08-30: this was written when deps-policy had no `react` group, so the item offered two
routes — create one, or compare against the starter at its resolved tag. The group now exists and
`toPolicyPackageType` passes `react` through, so the first route is taken. What remains is moving
`REACT_RUNTIME_DEPS` / `REACT_DEV_DEPS` onto it, which also gives `_templates/`-style drift checking
for free.

Small, self-contained, and it removes a live source of wrong output.

### 4. `design-docs` genx feature

Add a `design-docs` feature to set up `docs/specs/`, `docs/scratch/`, triage script, and
instruction file in any `@finografic` package. Unblocked 2026-08-19 by #6 — the triage step is now
`pnpm --package=@finografic/project-scripts dlx triage-docs`, so the feature ships an instruction
file and the two directories rather than a script.

`docs/specs/` now exists in genx as a real consumer, so the shape is no longer hypothetical.
Use the `generate-new-genx-feature` skill before writing any module.

---

## P2 — Planned

### 14. Scheduled managed drift report

A read-only `genx managed deps --check --json` that a scheduler can call, so drift is reported
without anything being applied. genx owns the facts; cron or Hermes owns the delivery, and genx
learns nothing about either.

Report-only on purpose. On 2026-08-30 a routine `oxlint 1.79 → 1.80` bump broke lint in three repos
and needed three unrelated fixes — an unattended apply would have committed all of it. Note that was
a _minor_: semver is not a safety signal for lint tooling, so "auto-apply patches" is not a safe
middle ground either.

Blocked on #13. `managed live` already gathers these facts for its table, so `--json` is the same
data with a different renderer rather than a parallel implementation.

A purpose-built Google ADK agent was considered and rejected for this; the reasoning and the trigger
to revisit are recorded in the detail doc.

Detail: [`docs/todo/TODO_MANAGED_DRIFT_REPORT.md`](./TODO_MANAGED_DRIFT_REPORT.md)

### 11. What does a workspace root own? — upgrade operation scoping

**Open design question, not yet a task.** v1 scopes _features_ (root / member / blocked) but never
scoped _operations_ — they all run against the workspace root as if it were an ordinary package, and
have never been exercised there. Settle ownership first, then route by it.

Detail: [`docs/specs/2026-08-19-workspace-ownership-model.md`](../specs/2026-08-19-workspace-ownership-model.md)

### 2. Type-specific policy divergence in deps-policy

Allow `library.ts` and `config.ts` in `@finografic/deps-policy` to intentionally diverge from
`base` where it makes sense (e.g., `config` packages may not need `vitest` or `@types/node`).
Deferred until concrete need arises.

### 9. Vitest DOM environment for React packages without a bundler config

`previewVitest` decides the test environment as a side effect of which template it picks, and the
template choice keys off whether the package has a `vite.config.ts` to `mergeConfig`. A shadcn-style
component library has no bundler config of its own — the consuming app owns it — so it falls back to
the base template and `environment: 'node'`, while the app that mostly does routing gets
`happy-dom`. Backwards: the component library is the DOM-dependent one.

Two changes, both small:

1. Treat `react` alone as frontend for test-environment purposes. `inferPackageTypeId` currently
   needs `react` **and** `vite`, so a component library is typed `library` and never reaches the
   frontend branch.
2. Decide the environment independently of the template. `_templates/` is the only content source,
   so this means a third template (standalone react — `defineConfig` with `happy-dom`, no
   `mergeConfig`) rather than patching the base template's string.

No failure until someone writes the first component test, at which point the fix by hand is one line
plus one devDependency. Observed 2026-08-19 on a generated monorepo's `packages/ui`.

### 5. `generate-new-genx-feature` skill — modernize for diff-as-detection

Update the `feature-template/` skeleton so newly scaffolded features use the preview-driven
detect/apply pattern (`*.preview.ts`) instead of the old signal-based detection.
Blocked on choosing a reference feature.

### 8. `genx design` — follow-ups (core command shipped 2026-08-13)

Remaining from the shipped command: push mapping-file support only — deferred until ambiguity is
proven in real use. The `design-md` audit feature and render→`.gitignore` wiring shipped
2026-08-13.

Pilots against the real `@finografic/design-system` (PandaCSS) and `@finografic/lucide-manager`
(Tailwind v4 + shadcn) are done (2026-08-13) — seven extraction defects found and fixed; both
extractors now verified against real input rather than only self-confirming fixtures. Dark mode is
decided: DESIGN.md mirrors the base palette only, per the spec, and says so. That closes the shadcn
CSS-vars writer rather than scheduling it.

Detail: [`docs/todo/TODO_DESIGN_COMMAND.md`](./TODO_DESIGN_COMMAND.md)

### 7. Extract "find file section" helpers to `@finografic/cli-kit`

Promote reusable section find/replace helpers (`.gitignore` `# Title` blocks) from genx into
`@finografic/cli-kit`. Genx-side behavior shipped; port to cli-kit still pending.

Detail: [`docs/todo/TODO_FIND_FILE_SECTION.md`](./TODO_FIND_FILE_SECTION.md)

---

## P3 — Backlog / Ideas

### Retire the skills dual-write (tail of #12)

genx still dual-writes the shared skills into repositories that have no `skills-lock.json`. That
branch is unreachable once every managed repository has migrated, at which point it deletes cleanly
along with its tests, `ai-agent-config`'s `assets/skills/`, and that package's dual-write assertion.
`ai-agent-config`'s manifest entry then moves to an `external` ownership mode rather than being
deleted, so genx keeps reporting who owns those paths.

**Not a prerequisite for anything.** Migration is per-repository and unordered by design, and a
half-migrated ecosystem is a valid steady state — the lockfile gate exists precisely so this can
wait. Pick it up when the count reaches zero, not before.

Detail: [`docs/specs/2026-08-23-skill-distribution-model.md`](../specs/2026-08-23-skill-distribution-model.md) steps D–F

### Monorepo generator v2 — additive starter slices

Reduce `monorepo-starter` to a minimal core plus opt-in overlays (`_slices/auth/`, `_slices/i18n/`,
`_slices/design-system-<x>/`). Additive rather than subtractive: auth spans server files, client
context, pages, db schemas and routes, so post-clone deletion leaves dangling imports. Gated on
real demand. Detail: [`DONE_MONOREPO_GENERATOR.md`](./DONE_MONOREPO_GENERATOR.md).

### cli-kit managed-loop extraction review

Review whether the managed-target prompt/loop primitive (`runManagedLoop`) is generic enough
to move into `@finografic/cli-kit` or should stay local to genx.

Detail: [`docs/todo/TODO_CLI_KIT_MANAGED_LOOP_REVIEW.md`](./TODO_CLI_KIT_MANAGED_LOOP_REVIEW.md)

### `maintain-project-memory` skill

Add a procedural skill for reviewing, repairing, and deduplicating roadmap, handoff, and
session-memory docs.

Detail: [`docs/todo/TODO_MAINTAIN_PROJECT_MEMORY_SKILL.md`](./TODO_MAINTAIN_PROJECT_MEMORY_SKILL.md)

### cli-kit Phase 2 — features inject cli-kit into generated projects

Audit `create` command + `_templates/package.json` — add `@finografic/cli-kit` as a generated dep.
Update `_templates/` skeleton imports to use `cli-kit/*` subpaths.

Detail: [`docs/todo/TODO_MIGRATE_TO_CLI_KIT.md`](./TODO_MIGRATE_TO_CLI_KIT.md)

### Upgrade command — cli-kit extraction review (Phase 4)

Review managed-target config/path handling, per-target apply/skip/cancel loop, and upgrade-mode
branching for reuse potential in `@finografic/cli-kit`.

Detail: [`docs/todo/DONE_UPGRADE_COMMAND_REFACTOR.md`](./DONE_UPGRADE_COMMAND_REFACTOR.md) (Phase 4)

---

## Non-starters (excluded)

- **Auto-publish on version bump** — too much automation risk; manual release gates are intentional.
- **Removing granular upgrade operation selection** — `deps` command coexists as a fast path;
  operation selection retains value for other upgrade sections.

---

## Done

| Date       | Item                                                                                                                                                                                                                                                                                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-24 | `upgrade` integrity pass — every operation now previews and confirms, `-y` reaches operations and root features, and blanket writers stopped claiming keys their owning feature already writes. Fourteen defects, all found by running `genx upgrade` against a real repository — [`docs/specs/2026-08-24-upgrade-integrity.md`](../specs/2026-08-24-upgrade-integrity.md) |
| 2026-08-24 | `.github/instructions/` retirement runs on an ordinary upgrade — owned by `ai-instructions`, moves `project/` content rather than losing it, and removes the directory once empty                                                                                                                                                                                          |
| 2026-08-24 | #12 Skill distribution moves to the Agent Skills CLI (genx side) — lockfile gate, genx's own skills as canonical + symlink, and `upgrade` / both `create` commands invoking the pinned CLI — [`2026-08-23-skill-distribution-model.md`](../specs/2026-08-23-skill-distribution-model.md)                                                                                   |
| 2026-08-19 | `triage-docs` cross-project portability — shipped as a `triage-docs` bin in `@finografic/project-scripts` 2.0.0, consumed via `pnpm dlx` like `purge-builds`; genx's local `scripts/triage-docs.ts` deleted and the skill, instruction file and dependency repointed. Unblocks #4                                                                                          |
| 2026-08-19 | Monorepo generator v1 — `upgrade` routes features by workspace scope: `genx:workspace:monorepo` marker, `pnpm-workspace.yaml` member resolution, doc/agent features at the root, package-scoped features per selected member, starter-owned toolchain skipped — [`DONE_MONOREPO_GENERATOR.md`](./DONE_MONOREPO_GENERATOR.md)                                               |
| 2026-08-19 | `upgrade` merges confirm per file — `merges` no longer writes package.json from a filename list, rides with `package-json` in the picker, plans only real changes, and keeps the trailing newline                                                                                                                                                                          |
| 2026-08-17 | `genx create` aligns scaffolded dependency versions to deps-policy — `_templates/package.json` no longer carries a second copy of every version (it was 11 stale for every package type)                                                                                                                                                                                   |
| 2026-08-17 | `genx create monorepo` (v0) — clone a pinned `monorepo-starter` tag, rewrite root identity, apply doc/agent features only, seed `.env.development` + database — [`DONE_MONOREPO_GENERATOR.md`](./DONE_MONOREPO_GENERATOR.md), [`MONOREPO_GENERATION.md`](../process/MONOREPO_GENERATION.md)                                                                                |
| 2026-08-13 | Asset ownership contract — manifest-driven resolution, fail-closed ownership, seed protection, skills fixed to managed, removal semantics decided — [`TODO_ASSET_OWNERSHIP_CONTRACT.md`](./TODO_ASSET_OWNERSHIP_CONTRACT.md)                                                                                                                                               |
| 2026-08-13 | `genx design` command (sync --pull/--push, check, render, lint; PandaCSS + Tailwind v4) — [`TODO_DESIGN_COMMAND.md`](./TODO_DESIGN_COMMAND.md)                                                                                                                                                                                                                             |
| 2026-07-26 | Migrate agent instructions/skills `.github/` → `.agents/`, dual-write `.claude/skills/`, self-update lifecycle — [`DONE_AGENTS_DIR_MIGRATION.md`](./DONE_AGENTS_DIR_MIGRATION.md)                                                                                                                                                                                          |
| 2026-07-07 | Deps policy refresh and managed deps snapshot flow — [`DONE_DEPS_UPDATE_POLICY.md`](./DONE_DEPS_UPDATE_POLICY.md)                                                                                                                                                                                                                                                          |
| 2026-07-06 | Public commands simplified — [`DONE_PUBLIC_COMMANDS_SIMPLIFIED.md`](./DONE_PUBLIC_COMMANDS_SIMPLIFIED.md)                                                                                                                                                                                                                                                                  |
| 2026-06-02 | AI Memory feature — [`DONE_AI_MEMORY_FEATURE.md`](./DONE_AI_MEMORY_FEATURE.md)                                                                                                                                                                                                                                                                                             |
| 2026-06-02 | Audit feature hardening and manual feature-install verification                                                                                                                                                                                                                                                                                                            |
| 2026-05-27 | #13 React package type + react-vite feature — [`DONE_REACT_PACKAGE.md`](./DONE_REACT_PACKAGE.md)                                                                                                                                                                                                                                                                           |
| 2026-05-26 | #12 Remove legacy dprint logic from genx                                                                                                                                                                                                                                                                                                                                   |
| 2026-05-26 | #11 Remove legacy stylelint logic from genx                                                                                                                                                                                                                                                                                                                                |
| 2026-05-26 | #10 Convert `--managed` flag into a `managed` command — [`DONE_MANAGED_COMMAND.md`](./DONE_MANAGED_COMMAND.md)                                                                                                                                                                                                                                                             |
| 2026-05-26 | #9 Toolchain version consumption from deps-policy — [`DONE_TOOLCHAIN_GENX.md`](./DONE_TOOLCHAIN_GENX.md)                                                                                                                                                                                                                                                                   |
| 2026-05-26 | #8 Remove legacy ESLint from genx codebase                                                                                                                                                                                                                                                                                                                                 |
| 2026-05-26 | Command folder restructure — [`DONE_COMMAND_FOLDER_RESTRUCTURE.md`](./DONE_COMMAND_FOLDER_RESTRUCTURE.md)                                                                                                                                                                                                                                                                  |
| 2026-05-26 | Upgrade command refactor (Phases 1-3) — [`DONE_UPGRADE_COMMAND_REFACTOR.md`](./DONE_UPGRADE_COMMAND_REFACTOR.md)                                                                                                                                                                                                                                                           |
| 2026-04-26 | XDG-first policy loader — [`DONE_XDG_POLICY_LOADER.md`](./DONE_XDG_POLICY_LOADER.md)                                                                                                                                                                                                                                                                                       |
| 2026-04-07 | #3 Husky template completion                                                                                                                                                                                                                                                                                                                                               |
| 2026-04-07 | Diff-as-detection (preview-driven detect/apply)                                                                                                                                                                                                                                                                                                                            |
| 2026-04-07 | jsdiff per-file diff display                                                                                                                                                                                                                                                                                                                                               |
| 2026-04-07 | Structured markdown section management                                                                                                                                                                                                                                                                                                                                     |
| 2026-04-07 | `ai-agents` feature (AGENTS.md + skills scaffold)                                                                                                                                                                                                                                                                                                                          |
| 2026-04-06 | Bulk orchestrator (`--managed` flag, now `managed` command)                                                                                                                                                                                                                                                                                                                |

| Date       | Deleted file (obsolete)                                                   |
| ---------- | ------------------------------------------------------------------------- |
| 2026-05-26 | `TODO.ESLINT_INSTALL.md` — ESLint fully removed from genx                 |
| 2026-05-26 | `TODO.NEW_HELP.md` — `withHelp` migration completed in folder restructure |
| 2026-05-26 | `TODO.ROADMAP_HISTORIC.md` — superseded by current ROADMAP                |
| 2026-05-26 | `TODO.react-feature.md` — promoted to ROADMAP #13                         |
| 2026-05-26 | `sessions.diff` — raw session artifact, not a planning doc                |
