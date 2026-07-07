# DONE — Convert `--managed` into a `managed`

> **Status:** Done (2026-05-26). `genx managed <command>` implemented; `--managed` flag kept as deprecated alias.

Replace the cross-cutting `--managed` flag with a clearer-level entrypoint for multi-repo runs.

---

## Goal

Move from:

- `genx upgrade --managed`
- `genx deps --managed`
- `genx features --managed`

to a-oriented model such as:

- `genx managed upgrade`
- `genx managed deps`
- `genx managed features`

This makes multi-repo execution a first-class instead of a flag bolted onto multiples.

---

## Phase 1 — Define shape

- [x] Confirm the name: `managed`
- [x] Confirm initial supported subcommands:
  - `upgrade`
  - `deps`
  - `features`
- [x] Decide whether unsupporteds should error or show help

---

## Phase 2 — Move orchestration ownership

- [x] Make the `managed` own:
  - reading configured managed targets
  - iterating targets
  - per-target apply / skip / cancel prompts
  - managed-run summary output
- [x] Keep subcommands focused on a single target only

---

## Phase 3 — Reuse single-target runners

- [x] Route `managed upgrade` through upgrade’s single-target runner
- [x] Route `managed deps` through deps’ single-target runner
- [x] Route `managed features` through features’ single-target runner
- [x] Avoid duplicating business logic in the new

---

## Phase 4 — Transition away from the flag

- [x] Keep `--managed` temporarily as a compatibility alias
- [x] Print a migration hint when the flag is used
- [x] Update help text and examples to prefer `genx managed <command>`
- [x] Remove the flag later once the new is established

---

## Phase 5 — Docs and CLI help

- [x] Add `managed` to root CLI help
- [x] Add a dedicated `managed` help file
- [x] Update README generated usage/examples
- [x] Remove `--managed` references from help when the transition is complete

---

## Recommendation

- Yes: this is a worthwhile cleanup
- `managed` as a is clearer than a cross-cutting flag
- Implement it by reusing existing single-target runners rather than inventing a second execution path
