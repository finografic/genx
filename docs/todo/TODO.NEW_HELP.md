# TODO: Migrate genx commands to withHelp

## Status

- [ ] pending

## Goal

Replace the manual `--help` / `-h` guard at the top of each genx command with the `withHelp`
wrapper from `@finografic/cli-kit/render-help`. Same change has already been applied in
`@finografic/deps-policy` (all three commands).

## Context

`withHelp` is already exported from `@finografic/cli-kit/render-help`:

```ts
async function withHelp(
  argv: string[],
  config: CommandHelpConfig,
  run: () => void | Promise<void>,
): Promise<void>
```

**However:** all four genx command help configs currently use `HelpConfig` (not `CommandHelpConfig`)
and call `renderHelp` (not `renderCommandHelp`). Before applying `withHelp`, decide:

**Option A — Extend `withHelp` in cli-kit** to accept `HelpConfig | CommandHelpConfig` and
dispatch to the correct render function based on type. Cleanest for callers; requires a
small cli-kit change + rebuild.

**Option B — Convert genx help configs to `CommandHelpConfig`** and switch calls from
`renderHelp` → `renderCommandHelp`. More work (rewrite 4 help objects) but makes the
per-command help pages richer and consistent with other `@finografic` CLIs.

**Option C — Add a second wrapper `withRootHelp(argv, config: HelpConfig, run)`** to
cli-kit alongside the existing `withHelp`. Minimal change, clear naming.

Recommendation: **Option A** — a union param is the least disruptive path.

## Files to change

### 1. `@finografic/cli-kit` (if Option A or C)

- `src/render-help/render-help.utils.ts` — update `withHelp` signature
- Rebuild + bump version, sync in genx via `pnpm update @finografic/cli-kit --latest`

### 2. `src/commands/create.cli.ts`

Current (lines 39–42):

```ts
if (argv.includes('--help') || argv.includes('-h')) {
  renderHelp(createHelp);
  return;
}
```

After (wraps entire function body):

```ts
export async function createPackage(argv: string[], context: { cwd: string }): Promise<void> {
  return withHelp(argv, createHelp, async () => {
    // existing body
  });
}
```

### 3. `src/commands/deps.cli.ts` — same pattern (lines 68–71)

### 4. `src/commands/features.cli.ts` — same pattern (lines 30–33)

### 5. `src/commands/migrate.cli.ts` — same pattern (lines 55–58)

## Verification

```bash
pnpm typecheck
pnpm build
genx create --help
genx deps --help
genx features --help
genx migrate --help
```

## Note

`src/cli.ts` (root routing) uses `renderHelp` for the global `genx --help` and unknown-command
fallback. Those are NOT candidates for `withHelp` — the root router is not a command function.
