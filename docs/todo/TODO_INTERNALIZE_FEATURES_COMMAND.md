# TODO — Internalize the Features Command

> **Status:** Planned (2026-06-02). Make `genx audit` the canonical public single-project feature-management command while retaining reusable feature infrastructure internally.

## Context

`genx features` and `genx audit` now share the same feature registry and application engine, but
their public single-project workflows overlap:

| Capability                             | `genx features`             | `genx audit`                                |
| -------------------------------------- | --------------------------- | ------------------------------------------- |
| Lists registered features              | Yes                         | Yes                                         |
| Evaluates target state before prompt   | No                          | Yes                                         |
| Distinguishes missing from drift       | No                          | Yes: `missing`, `partial`, `installed`      |
| Shows status metadata                  | No                          | Yes                                         |
| Keeps installed features visible       | No                          | Yes, disabled with `ok — config up to date` |
| Filters self-package features          | No                          | Yes                                         |
| Applies selected feature preview diffs | Yes                         | Yes, through the same application engine    |
| Supports multi-repo selection once     | Via `genx managed features` | Not yet                                     |

For a single target, `genx audit` is the clearer and more capable interface. The public
`genx features` command no longer needs to remain a separate user-facing workflow.

## Decision

- Make `genx audit` the only public single-project feature-management command.
- Remove `genx features` from public CLI routing, help output, README usage, and examples.
- Keep the feature application engine internal and reusable.
- Keep `genx managed features` temporarily because it has a distinct bulk workflow: select one
  feature set once, then apply it across configured targets.
- Evaluate `genx managed audit` separately before deciding whether `genx managed features` can also
  be retired.

## Internal APIs to Preserve

These are infrastructure, not deprecated behavior:

- `src/features/feature-registry.ts`
- `src/lib/prompts/features.prompt.ts`
- `applyFeaturesToTarget()` or an equivalent renamed internal runner
- Feature `detect()`, `audit()`, `preview`, and `apply()` implementations
- Feature selection during `genx create`
- Optional feature selection during `genx migrate`
- Bulk application through `genx managed features`

The current shared runner lives in `src/commands/features/features.cli.ts`. Once the public command
is removed, move it to a neutral internal location so `audit` and managed flows do not import from a
deleted or misleading public-command module.

Suggested location:

```text
src/lib/features/apply-features.runner.ts
```

## Phase 1 — Extract Internal Feature Application

- [ ] Move `applyFeaturesToTarget()` out of `src/commands/features/features.cli.ts`.
- [ ] Place the runner under a neutral internal path such as
      `src/lib/features/apply-features.runner.ts`.
- [ ] Update `src/commands/audit/audit.cli.ts` to import the internal runner.
- [ ] Update `src/commands/managed/managed.features.ts` to import the internal runner.
- [ ] Check whether migrate has a parallel feature loop that should reuse the same runner or remain
      separate because migrate has different tail behavior.
- [ ] Preserve per-file diff confirmations and `yesAll` behavior.
- [ ] Preserve dependency installation behavior owned by individual feature apply functions.
- [ ] Add or update focused tests for internal runner behavior if extraction changes coverage.

## Phase 2 — Remove the Public Single-Project Command

- [ ] Remove the `features` command route from `src/cli.ts`.
- [ ] Delete `src/commands/features/features.cli.ts` after the internal runner extraction.
- [ ] Delete `src/commands/features/features.help.ts`.
- [ ] Update root CLI help so `features` is no longer advertised as a top-level command.
- [ ] Confirm `genx features` now returns the normal unknown-command response.
- [ ] Keep `promptFeatures()` because it remains used by create, migrate, and managed workflows.

## Phase 3 — Keep Managed Features Explicitly Supported

- [ ] Keep `genx managed features` routed through `src/commands/managed/managed.features.ts`.
- [ ] Keep the managed help entry and example for `features`.
- [ ] Confirm managed features still selects one feature set before iterating targets.
- [ ] Confirm managed features still prompts apply / skip / cancel per target unless `--yes`.
- [ ] Confirm managed features still applies preview diffs per changed file unless `--yes`.
- [ ] Do not silently replace managed features with per-target audits; that would change interaction
      semantics and repeat selection work for every target.

## Phase 4 — Documentation

- [ ] Run `pnpm docs:usage` after CLI and help changes.
- [ ] Remove the generated public `genx features` command section from `README.md`.
- [ ] Update manually maintained README text to recommend `genx audit` for adding or repairing
      features in one existing package.
- [ ] Keep README references to `genx managed features` where bulk application is documented.
- [ ] Update any process docs that prescribe `genx features` for single-target use.
- [ ] Update `.agents/handoff.md` with the final public command model.
- [ ] Move this doc to `DONE_INTERNALIZE_FEATURES_COMMAND.md` when complete.

## Phase 5 — Verification

- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm lint:ci`.
- [ ] Run `pnpm format:check`.
- [ ] Run focused audit and managed-command tests.
- [ ] Run `pnpm test:run`.
- [ ] Run `pnpm docs:usage` and confirm README generation is stable.
- [ ] Manual smoke: `genx audit` on a package with missing, partial, and installed features.
- [ ] Manual smoke: `genx managed features` across disposable managed targets.
- [ ] Manual smoke: `genx features` produces the expected unknown-command response.

## Follow-Up — Evaluate `genx managed audit`

Do not bundle this into the initial cleanup unless the desired UX is clear.

Questions to answer:

- Should `genx managed audit` be report-only, interactive repair, or support both modes?
- Should it audit all targets first and show a summary before applying anything?
- Should selection happen once globally, once per target, or only after reviewing a cross-target
  report?
- Would `genx managed audit --yes` repair all partial / missing features automatically, or still
  require explicit feature selection?
- Once managed audit exists, does `genx managed features` still provide a simpler intentional bulk
  install workflow worth keeping?

## Non-Goals

- Do not remove the feature registry.
- Do not remove feature selection from `create` or `migrate`.
- Do not change feature detect/apply semantics during the command cleanup.
- Do not retire `genx managed features` until a replacement has been designed and tested.
- Do not add a compatibility alias unless there is a concrete user need; the command can fail
  clearly as unknown after removal.
