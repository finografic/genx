# TODO — Review managed-target loop for cli-kit extraction

Review the repeated per-target **apply / skip / cancel** loop used by `genx` managed flows and decide
whether it should become a shared orchestration primitive in `@finografic/cli-kit`.

---

## Goal

Determine whether the current managed-target prompt/loop pattern is:

- generic enough to move into `@finografic/cli-kit`
- still too `genx`-specific and better kept local for now

This should stay focused on the **prompt + iteration primitive**, not on managed-repo config loading.

---

## Phase 1 — Audit current usages

- [ ] Find every current managed-target loop in `genx`
- [ ] Compare differences between commands:
  - action label text
  - `--yes` behavior
  - target display formatting
  - success summary wording
  - cancel semantics
- [ ] Confirm whether the current shape is truly shared or only superficially similar

---

## Phase 2 — Define the minimum portable abstraction

- [ ] Draft the smallest possible API for the loop
- [ ] Keep config lookup out of scope
- [ ] Keep business logic out of scope
- [ ] Focus only on:
  - iterating targets
  - prompting apply / skip / cancel
  - honoring yes-mode
  - returning processed / skipped counts

Potential shape:

- `targets`
- `yesMode`
- `actionLabel`
- `runTarget(target)`
- optional `formatTarget(target)` / display helper

---

## Phase 3 — Prototype locally in genx first

- [x] Refactor current managed command flows to a cleaner local generic helper
- [x] Reuse it from more than one command
- [x] Confirm that command-specific differences do not force awkward options into the abstraction

---

## Phase 4 — Decide extraction

- [ ] If the helper stays small and reusable across multiple commands, extract it to `cli-kit`
- [ ] If the helper needs too much `genx` policy knowledge, keep it local
- [ ] Document the decision in the handoff or roadmap if it affects future command design

---

## Recommendation

- Start with a **local generic helper in `genx`**
- Extract to `cli-kit` only after at least one more command proves the abstraction is stable
