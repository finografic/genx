# TODO — Convert `--managed` into a `managed` command

Replace the cross-cutting `--managed` flag with a clearer command-level entrypoint for multi-repo runs.

---

## Goal

Move from:

- `genx migrate --managed`
- `genx deps --managed`
- `genx features --managed`

to a command-oriented model such as:

- `genx managed migrate`
- `genx managed deps`
- `genx managed features`

This makes multi-repo execution a first-class command instead of a flag bolted onto multiple commands.

---

## Phase 1 — Define command shape

- [ ] Confirm the command name: `managed`
- [ ] Confirm initial supported subcommands:
  - `migrate`
  - `deps`
  - `features`
- [ ] Decide whether unsupported commands should error or show help

---

## Phase 2 — Move orchestration ownership

- [ ] Make the `managed` command own:
  - reading configured managed targets
  - iterating targets
  - per-target apply / skip / cancel prompts
  - managed-run summary output
- [ ] Keep subcommands focused on a single target only

---

## Phase 3 — Reuse single-target runners

- [ ] Route `managed migrate` through migrate’s single-target runner
- [ ] Route `managed deps` through deps’ single-target runner
- [ ] Route `managed features` through features’ single-target runner
- [ ] Avoid duplicating business logic in the new command

---

## Phase 4 — Transition away from the flag

- [ ] Keep `--managed` temporarily as a compatibility alias
- [ ] Print a migration hint when the flag is used
- [ ] Update help text and examples to prefer `genx managed <command>`
- [ ] Remove the flag later once the new command is established

---

## Phase 5 — Docs and CLI help

- [ ] Add `managed` to root CLI help
- [ ] Add a dedicated `managed` command help file
- [ ] Update README generated usage/examples
- [ ] Remove `--managed` references from command help when the transition is complete

---

## Recommendation

- Yes: this is a worthwhile cleanup
- `managed` as a command is clearer than a cross-cutting flag
- Implement it by reusing existing single-target runners rather than inventing a second execution path
