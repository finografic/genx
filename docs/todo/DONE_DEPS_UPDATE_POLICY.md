# DONE — deps policy refresh and managed deps snapshot flow

> **Completed:** 2026-07-07

`genx deps` and `genx managed deps` now separate policy refresh from project dependency
alignment.

## Shipped Behavior

- `genx deps --update-policy` refreshes the local `@finografic/deps-policy` source and XDG
  snapshot, then exits without syncing a target project.
- `genx managed deps` syncs all configured targets to the current local policy snapshot.
- `genx managed deps --update-policy` refreshes the local policy snapshot once, then syncs all
  configured targets against that same snapshot in one command.
- Deprecated `genx deps --managed --update-policy` follows the same refresh-then-sync behavior.

## Rationale

Managed deps originally refreshed deps-policy automatically before every managed run. That made
repeat runs non-idempotent when deps-policy itself could still move between runs. The explicit flag
keeps normal managed runs stable while preserving a one-command refresh-and-sync path when wanted.

## Verification

- `pnpm typecheck`
- `pnpm lint:ci`
- `pnpm lint:md`
- `pnpm test:run`
- `pnpm format:check`
- `git diff --check`
