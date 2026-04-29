# TODO — Refactor `migrate` Command

> **Status:** Phase 1 complete. Phase 2 not started.

Refactor `src/commands/migrate/migrate.cli.ts` into a thinner command entry that matches the newer
`@finografic/cli-kit`-oriented command style:

- command entry stays focused on routing, lifecycle, and top-level mode selection
- migrate-only helpers live under `src/commands/migrate/lib/`
- shared utilities stay in `src/lib/` only when more than one command genuinely depends on them
- generic CLI primitives remain candidates for eventual extraction to `@finografic/cli-kit`

Pause after each phase to review and check off the section before moving to the next one.

---

## Phase 1 — Reclaim migrate-only boundaries

- [x] Audit which `src/lib/migrate/` helpers are migrate-owned vs shared
- [x] Move `parseMigrateArgs`, `shouldRunSection`, and `getScopeAndName` into `src/commands/migrate/lib/`
- [x] Keep `dependencies.utils.ts` in `src/lib/migrate/` because `deps` depends on it
- [x] Keep `package-json.utils.ts` in `src/lib/migrate/` because multiple commands/features depend on it
- [x] Remove the last migrate command imports that still point at `src/lib/migrate/migrate-metadata.utils.ts`
- [x] Leave behavior unchanged

**Pause here:** review the file-boundary cleanup before extracting larger runners.

---

## Phase 2 — Thin the command entry

- [ ] Extract managed-target orchestration from `migrate.cli.ts` into a command-local runner
- [ ] Extract single-target interactive mode selection from `migrate.cli.ts`
- [ ] Extract `agent-docs` mode into its own command-local runner module
- [ ] Keep `migrate.cli.ts` focused on `withHelp()`, argument parsing, and top-level dispatch
- [ ] Leave behavior unchanged

**Pause here:** confirm the entrypoint shape before splitting the single-target write flow.

---

## Phase 3 — Split single-target migrate flow

- [ ] Extract single-target validation/read/setup into a dedicated helper
- [ ] Extract dry-run rendering into a read-only helper
- [ ] Extract write/apply flow into a dedicated helper or module
- [ ] Extract feature-application tail work into a helper
- [ ] Extract dependency-install tail work into a helper
- [ ] Keep the same user-facing behavior and prompts

**Pause here:** confirm the internal shape before considering any cli-kit extraction.

---

## Phase 4 — Review cli-kit candidates

- [ ] Review managed-target config/path handling against `@finografic/cli-kit/xdg` and `paths`
- [ ] Review the per-target apply/skip/cancel loop as a possible shared orchestration primitive
- [ ] Review migrate-mode selection / command-mode branching for reuse potential
- [ ] Document only the truly portable candidates — do not move `@finografic` policy logic

**Pause here:** decide whether any extraction belongs in cli-kit or should remain local to genx.
