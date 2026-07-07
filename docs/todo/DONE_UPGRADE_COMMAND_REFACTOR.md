# DONE — Refactor `upgrade` Command

> **Completed:** 2026-05-26. Phase 4 (cli-kit extraction review) tracked in `TODO_CLI_KIT_MANAGED_LOOP_REVIEW.md`.

Refactor `src/commands/upgrade/upgrade.cli.ts` into a thinner entry that matches the newer
`@finografic/cli-kit`-oriented style:

- entry stays focused on routing, lifecycle, and top-level mode selection
- upgrade-only helpers live under `src/commands/upgrade/lib/`
- shared utilities stay in `src/lib/` only when more than one genuinely depends on them
- generic CLI primitives remain candidates for eventual extraction to `@finografic/cli-kit`

Pause after each phase to review and check off the section before moving to the next one.

---

## Phase 1 — Reclaim upgrade-only boundaries

- [x] Audit which `src/lib/package-policy/` helpers are upgrade-owned vs shared
- [x] Move `parseUpgradeArgs`, `shouldRunSection`, and `getScopeAndName` into `src/commands/upgrade/lib/`
- [x] Keep `dependencies.utils.ts` in `src/lib/package-policy/` because `deps` depends on it
- [x] Keep `package-json.utils.ts` in `src/lib/package-policy/` because multiple commands/features depend on it
- [x] Remove the last upgrade imports that still point at `src/commands/upgrade/lib/upgrade-metadata.utils.ts`
- [x] Leave behavior unchanged

**Pause here:** review the file-boundary cleanup before extracting larger runners.

---

## Phase 2 — Thin the entry

- [x] Extract managed-target orchestration from `upgrade.cli.ts` into a command-local runner
- [x] Extract single-target interactive mode selection from `upgrade.cli.ts`
- [x] Extract `agent-docs` mode into its own command-local runner module
- [x] Keep `upgrade.cli.ts` focused on `withHelp()`, argument parsing, and top-level dispatch
- [x] Leave behavior unchanged

**Pause here:** confirm the entrypoint shape before splitting the single-target write flow.

---

## Phase 3 — Split single-target upgrade flow

- [x] Extract single-target validation/read/setup into a dedicated helper
- [x] Extract dry-run rendering into a read-only helper
- [x] Extract write/apply flow into a dedicated helper or module
- [x] Extract feature-application tail work into a helper
- [x] Extract dependency-install tail work into a helper
- [x] Keep the same user-facing behavior and prompts

**Pause here:** confirm the internal shape before considering any cli-kit extraction.

---

## Phase 4 — Review cli-kit candidates

- [ ] Review managed-target config/path handling against `@finografic/cli-kit/xdg` and `paths`
- [ ] Review the per-target apply/skip/cancel loop as a possible shared orchestration primitive
- [ ] Review upgrade-mode selection / command-mode branching for reuse potential
- [ ] Document only the truly portable candidates — do not move `@finografic` policy logic

**Pause here:** decide whether any extraction belongs in cli-kit or should remain local to genx.
