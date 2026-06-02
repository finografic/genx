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

## P0 — Active

### Internalize public `genx features` command

Make `genx audit` the canonical public single-project feature-management command. Preserve internal
feature infrastructure and keep `genx managed features` until a separate managed-audit UX is
designed.

Detail: [`docs/todo/TODO_INTERNALIZE_FEATURES_COMMAND.md`](./TODO_INTERNALIZE_FEATURES_COMMAND.md)

---

## P1 — Next Up

No items.

---

## P2 — Planned

### 1. `genx create` — apply resolvePolicy() immediately after scaffold

After scaffolding, run `resolvePolicy(packageType)` and write resolved dependency versions directly
into the new `package.json` instead of relying on hardcoded versions in `_templates/package.json`.
Low risk — additive change to the create pipeline.

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

### 7. Extract "find file section" helpers to `@finografic/cli-kit`

Promote reusable section find/replace helpers (`.gitignore` `# Title` blocks) from genx into
`@finografic/cli-kit`. Genx-side behavior shipped; port to cli-kit still pending.

Detail: [`docs/todo/TODO_FIND_FILE_SECTION.md`](./TODO_FIND_FILE_SECTION.md)

---

## P3 — Backlog / Ideas

### cli-kit managed-loop extraction review

Review whether the managed-target prompt/loop primitive (`runManagedLoop`) is generic enough
to move into `@finografic/cli-kit` or should stay local to genx.

Detail: [`docs/todo/TODO_CLI_KIT_MANAGED_LOOP_REVIEW.md`](./TODO_CLI_KIT_MANAGED_LOOP_REVIEW.md)

### `maintain-project-memory` skill

Add a procedural skill for reviewing, repairing, and deduplicating roadmap, next-steps, handoff,
and session-memory docs.

Detail: [`docs/todo/TODO_MAINTAIN_PROJECT_MEMORY_SKILL.md`](./TODO_MAINTAIN_PROJECT_MEMORY_SKILL.md)

### cli-kit Phase 2 — features inject cli-kit into generated projects

Audit `create` command + `_templates/package.json` — add `@finografic/cli-kit` as a generated dep.
Update `_templates/` skeleton imports to use `cli-kit/*` subpaths.

Detail: [`docs/todo/TODO_MIGRATE_TO_CLI_KIT.md`](./TODO_MIGRATE_TO_CLI_KIT.md)

### `genx deps --update-policy` and managed policy pre-update

Add `--update-policy` flag for interactive-only policy update, and silent policy pre-update
before `genx managed deps` runs.

Detail: [`docs/todo/TODO_DEPS_UPDATE_POLICY.md`](./TODO_DEPS_UPDATE_POLICY.md)

### Migrate command — cli-kit extraction review (Phase 4)

Review managed-target config/path handling, per-target apply/skip/cancel loop, and migrate-mode
branching for reuse potential in `@finografic/cli-kit`.

Detail: [`docs/todo/DONE_MIGRATE_COMMAND_REFACTOR.md`](./DONE_MIGRATE_COMMAND_REFACTOR.md) (Phase 4)

---

## Non-starters (excluded)

- **Auto-publish on version bump** — too much automation risk; manual release gates are intentional.
- **Removing `--only` from `migrate`** — `deps` command coexists as a fast path; `--only` retains
  value for other granular migrate operations.

---

## Done

| Date       | Item                                                                                                             |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| 2026-06-02 | AI Memory feature — [`DONE_AI_MEMORY_FEATURE.md`](./DONE_AI_MEMORY_FEATURE.md)                                   |
| 2026-06-02 | Audit feature hardening and manual feature-install verification                                                  |
| 2026-05-27 | #13 React package type + react-vite feature — [`DONE_REACT_PACKAGE.md`](./DONE_REACT_PACKAGE.md)                 |
| 2026-05-26 | #12 Remove legacy dprint logic from genx                                                                         |
| 2026-05-26 | #11 Remove legacy stylelint logic from genx                                                                      |
| 2026-05-26 | #10 Convert `--managed` flag into a `managed` command — [`DONE_MANAGED_COMMAND.md`](./DONE_MANAGED_COMMAND.md)   |
| 2026-05-26 | #9 Toolchain version consumption from deps-policy — [`DONE_TOOLCHAIN_GENX.md`](./DONE_TOOLCHAIN_GENX.md)         |
| 2026-05-26 | #8 Remove legacy ESLint from genx codebase                                                                       |
| 2026-05-26 | Command folder restructure — [`DONE_COMMAND_FOLDER_RESTRUCTURE.md`](./DONE_COMMAND_FOLDER_RESTRUCTURE.md)        |
| 2026-05-26 | Migrate command refactor (Phases 1-3) — [`DONE_MIGRATE_COMMAND_REFACTOR.md`](./DONE_MIGRATE_COMMAND_REFACTOR.md) |
| 2026-04-26 | XDG-first policy loader — [`DONE_XDG_POLICY_LOADER.md`](./DONE_XDG_POLICY_LOADER.md)                             |
| 2026-04-07 | #3 Husky template completion                                                                                     |
| 2026-04-07 | Diff-as-detection (preview-driven detect/apply)                                                                  |
| 2026-04-07 | jsdiff per-file diff display                                                                                     |
| 2026-04-07 | Structured markdown section management                                                                           |
| 2026-04-07 | `ai-agents` feature (AGENTS.md + skills scaffold)                                                                |
| 2026-04-06 | Bulk orchestrator (`--managed` flag, now `managed` command)                                                      |

| Date       | Deleted file (obsolete)                                                   |
| ---------- | ------------------------------------------------------------------------- |
| 2026-05-26 | `TODO.ESLINT_INSTALL.md` — ESLint fully removed from genx                 |
| 2026-05-26 | `TODO.NEW_HELP.md` — `withHelp` migration completed in folder restructure |
| 2026-05-26 | `TODO.ROADMAP_HISTORIC.md` — superseded by current ROADMAP                |
| 2026-05-26 | `TODO.react-feature.md` — promoted to ROADMAP #13                         |
| 2026-05-26 | `sessions.diff` — raw session artifact, not a planning doc                |
