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

- Run `genx upgrade` on `monorepo-starter` to adopt `.agents/instructions/` + `.agents/skills/`
  (still on legacy `.github/instructions/`), decline the package-shaped oxc-config diffs, then
  `pnpm release:github:minor`. Makes the generation-time migration a no-op. No genx change needed —
  generation resolves the newest tag on its own.

---

## P0 — Active

No items.

---

## P1 — Next Up

No items.

---

## P2 — Planned

### Monorepo generator v1 — workspace-aware upgrade

Add a `genx:workspace:monorepo` marker on the root plus member iteration over `pnpm-workspace.yaml`,
so package-scoped features (`vitest`, `css`, `reactVite`) can run against members instead of being
excluded outright. Detail: [`DONE_MONOREPO_GENERATOR.md`](./DONE_MONOREPO_GENERATOR.md).

### 2. Type-specific policy divergence in deps-policy

Allow `library.ts` and `config.ts` in `@finografic/deps-policy` to intentionally diverge from
`base` where it makes sense (e.g., `config` packages may not need `vitest` or `@types/node`).
Deferred until concrete need arises.

### 4. `design-docs` genx feature

Add a `design-docs` feature to set up `docs/specs/`, `docs/scratch/`, triage script, and
instruction file in any `@finografic` package. Blocked on #6 (triage-docs portability).

### 5. `generate-new-genx-feature` skill — modernize for diff-as-detection

Update the `feature-template/` skeleton so newly scaffolded features use the preview-driven
detect/apply pattern (`*.preview.ts`) instead of the old signal-based detection.
Blocked on choosing a reference feature.

### 6. `triage-docs` — cross-project portability

Make `scripts/triage-docs.ts` work as a standalone script that any `@finografic` project can use
without depending on genx's internal utilities. Decision needed on approach before implementing #4.

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

| Date       | Item                                                                                                                                                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-17 | `genx create` aligns scaffolded dependency versions to deps-policy — `_templates/package.json` no longer carries a second copy of every version (it was 11 stale for every package type)                                                                                                    |
| 2026-08-17 | `genx create monorepo` (v0) — clone a pinned `monorepo-starter` tag, rewrite root identity, apply doc/agent features only, seed `.env.development` + database — [`DONE_MONOREPO_GENERATOR.md`](./DONE_MONOREPO_GENERATOR.md), [`MONOREPO_GENERATION.md`](../process/MONOREPO_GENERATION.md) |
| 2026-08-13 | Asset ownership contract — manifest-driven resolution, fail-closed ownership, seed protection, skills fixed to managed, removal semantics decided — [`TODO_ASSET_OWNERSHIP_CONTRACT.md`](./TODO_ASSET_OWNERSHIP_CONTRACT.md)                                                                |
| 2026-08-13 | `genx design` command (sync --pull/--push, check, render, lint; PandaCSS + Tailwind v4) — [`TODO_DESIGN_COMMAND.md`](./TODO_DESIGN_COMMAND.md)                                                                                                                                              |
| 2026-07-26 | Migrate agent instructions/skills `.github/` → `.agents/`, dual-write `.claude/skills/`, self-update lifecycle — [`DONE_AGENTS_DIR_MIGRATION.md`](./DONE_AGENTS_DIR_MIGRATION.md)                                                                                                           |
| 2026-07-07 | Deps policy refresh and managed deps snapshot flow — [`DONE_DEPS_UPDATE_POLICY.md`](./DONE_DEPS_UPDATE_POLICY.md)                                                                                                                                                                           |
| 2026-07-06 | Public commands simplified — [`DONE_PUBLIC_COMMANDS_SIMPLIFIED.md`](./DONE_PUBLIC_COMMANDS_SIMPLIFIED.md)                                                                                                                                                                                   |
| 2026-06-02 | AI Memory feature — [`DONE_AI_MEMORY_FEATURE.md`](./DONE_AI_MEMORY_FEATURE.md)                                                                                                                                                                                                              |
| 2026-06-02 | Audit feature hardening and manual feature-install verification                                                                                                                                                                                                                             |
| 2026-05-27 | #13 React package type + react-vite feature — [`DONE_REACT_PACKAGE.md`](./DONE_REACT_PACKAGE.md)                                                                                                                                                                                            |
| 2026-05-26 | #12 Remove legacy dprint logic from genx                                                                                                                                                                                                                                                    |
| 2026-05-26 | #11 Remove legacy stylelint logic from genx                                                                                                                                                                                                                                                 |
| 2026-05-26 | #10 Convert `--managed` flag into a `managed` command — [`DONE_MANAGED_COMMAND.md`](./DONE_MANAGED_COMMAND.md)                                                                                                                                                                              |
| 2026-05-26 | #9 Toolchain version consumption from deps-policy — [`DONE_TOOLCHAIN_GENX.md`](./DONE_TOOLCHAIN_GENX.md)                                                                                                                                                                                    |
| 2026-05-26 | #8 Remove legacy ESLint from genx codebase                                                                                                                                                                                                                                                  |
| 2026-05-26 | Command folder restructure — [`DONE_COMMAND_FOLDER_RESTRUCTURE.md`](./DONE_COMMAND_FOLDER_RESTRUCTURE.md)                                                                                                                                                                                   |
| 2026-05-26 | Upgrade command refactor (Phases 1-3) — [`DONE_UPGRADE_COMMAND_REFACTOR.md`](./DONE_UPGRADE_COMMAND_REFACTOR.md)                                                                                                                                                                            |
| 2026-04-26 | XDG-first policy loader — [`DONE_XDG_POLICY_LOADER.md`](./DONE_XDG_POLICY_LOADER.md)                                                                                                                                                                                                        |
| 2026-04-07 | #3 Husky template completion                                                                                                                                                                                                                                                                |
| 2026-04-07 | Diff-as-detection (preview-driven detect/apply)                                                                                                                                                                                                                                             |
| 2026-04-07 | jsdiff per-file diff display                                                                                                                                                                                                                                                                |
| 2026-04-07 | Structured markdown section management                                                                                                                                                                                                                                                      |
| 2026-04-07 | `ai-agents` feature (AGENTS.md + skills scaffold)                                                                                                                                                                                                                                           |
| 2026-04-06 | Bulk orchestrator (`--managed` flag, now `managed` command)                                                                                                                                                                                                                                 |

| Date       | Deleted file (obsolete)                                                   |
| ---------- | ------------------------------------------------------------------------- |
| 2026-05-26 | `TODO.ESLINT_INSTALL.md` — ESLint fully removed from genx                 |
| 2026-05-26 | `TODO.NEW_HELP.md` — `withHelp` migration completed in folder restructure |
| 2026-05-26 | `TODO.ROADMAP_HISTORIC.md` — superseded by current ROADMAP                |
| 2026-05-26 | `TODO.react-feature.md` — promoted to ROADMAP #13                         |
| 2026-05-26 | `sessions.diff` — raw session artifact, not a planning doc                |
