# TODO — genx deps --update-policy and --managed policy pre-update

> **Status:** Not started

Two related additions to `genx deps`:

1. `genx deps --update-policy` — interactive policy update only (no dep sync)
2. `genx deps --managed` — runs policy update silently first, then cycles repos

Both use execa to call `pnpm policy:update` in the local deps-policy repo, whose
path is read from `depsPolicyPath` in `~/.config/finografic/genx.config.jsonc`.
After the update, `src/config/policy.ts` picks up the fresh XDG snapshot automatically.

---

## Context

- `depsPolicyPath` is a top-level key in `~/.config/finografic/genx.config.jsonc`
  (already added — `/Users/justin/repos-finografic/_@finografic-deps-policy`)
- `readDepsPolicyPath()` is already implemented in `src/utils/managed.utils.ts`
  — returns the path or `null` if not set
- `pnpm policy:update` patches source files AND auto-writes
  `~/.config/finografic/deps-policy.config.json` at the end
- `src/config/policy.ts` already reads that snapshot on startup — no extra wiring needed
- `execa` is already a dependency of genx

---

## Step 1 — Add `runPolicyUpdate` utility

Create `src/utils/policy-update.utils.ts`:

```ts
import { execa } from 'execa';
import { readDepsPolicyPath } from './managed.utils.js';

/**
 * Runs `pnpm policy:update` in the local deps-policy repo.
 * @param silent - When true, passes --yes and suppresses output (for --managed).
 * @returns true if the update ran, false if depsPolicyPath is not set in config.
 */
export async function runPolicyUpdate(silent: boolean): Promise<boolean> {
  const depsPolicyPath = await readDepsPolicyPath();
  if (!depsPolicyPath) return false;

  const args = silent ? ['policy:update', '--yes'] : ['policy:update'];

  await execa('pnpm', ['run', ...args], {
    cwd: depsPolicyPath,
    stdio: silent ? 'pipe' : 'inherit',
  });

  return true;
}
```

Notes:

- `stdio: 'inherit'` for interactive — lets clack prompts render correctly in the terminal
- `stdio: 'pipe'` for silent — suppresses all output (`--yes` produces minimal output anyway)
- If `depsPolicyPath` is not set in config, returns `false` and caller decides what to do

---

## Step 2 — `genx deps --update-policy`

In `src/commands/deps.cli.ts`:

**Import the utility:**

```ts
import { runPolicyUpdate } from 'utils/policy-update.utils.js';
```

**Parse the flag** (alongside the existing flag parsing at the top of `syncDeps`):

```ts
const updatePolicy = argv.includes('--update-policy');
```

**Guard — mutually exclusive with `--managed` and `[path]`:**

```ts
if (updatePolicy && (managed || pathArg)) {
  errorMessage('--update-policy cannot be combined with --managed or a path argument');
  process.exit(1);
}
```

**Handle early return** (before the managed block and single-target block):

```ts
if (updatePolicy) {
  const found = await runPolicyUpdate(false); // interactive
  if (!found) {
    errorMessage(
      `depsPolicyPath not set in config.\nAdd it to ${pc.cyan(GENX_CONFIG_PATH)} to use --update-policy.`,
    );
    process.exit(1);
  }
  return;
}
```

---

## Step 3 — `genx deps --managed` silent pre-update

In the `if (managed)` block, **before** the `readManagedTargets()` call, add:

```ts
// Silently update deps-policy first so the freshest versions are used for all targets.
await runPolicyUpdate(true);
```

No error if `depsPolicyPath` is not set — `runPolicyUpdate` returns false and execution
continues normally with the existing installed/snapshot versions.

---

## Step 4 — Update help (`src/help/deps.help.ts`)

Add to the `examples.list` array:

```ts
{
  label: 'Update deps-policy interactively (no dep sync)',
  description: 'genx deps --update-policy',
},
```

Update `main.args`:

```ts
args: '[path] [--update-policy] [options]',
```

---

## Step 5 — Verify

```bash
pnpm typecheck    # zero errors

# Test --update-policy (interactive)
genx deps --update-policy
# → clack prompts from policy:update appear in terminal
# → exits after update, does not sync any projects

# Test --managed (silent pre-update)
genx deps --managed --write
# → no policy prompts, silent update runs first
# → managed target loop uses freshly-written XDG snapshot versions
```

---

## Step 6 — Commit

```
feat(deps): add --update-policy flag and silent policy pre-update for --managed
```
