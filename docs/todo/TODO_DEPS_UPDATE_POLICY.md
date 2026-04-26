# TODO — genx deps --update-policy and --managed policy pre-update

> **Status:** Not started

Two related additions to `genx deps`:

1. `genx deps --update-policy` — interactive policy update only (no dep sync)
2. `genx deps --managed` — runs policy update silently first, then cycles repos

Both use execa to call `pnpm policy:update` in the local deps-policy repo, which
is discovered from the managed config. After the update, `src/config/policy.ts`
picks up the fresh XDG snapshot automatically.

---

## Context

- Local deps-policy path comes from `~/.config/finografic/genx.config.json` managed array
  — look for `name: '@finografic/deps-policy'`
- `pnpm policy:update` patches source files AND auto-writes
  `~/.config/finografic/deps-policy.config.json` at the end
- `src/config/policy.ts` already reads that snapshot on startup — no extra wiring needed
- `execa` is already a dependency of genx

---

## Step 1 — Add a helper to find the deps-policy local path

In `src/utils/managed.utils.ts`, add:

```ts
export async function findManagedPath(name: string): Promise<string | null> {
  try {
    const targets = await readManagedTargets();
    return targets.find((t) => t.name === name)?.path ?? null;
  } catch {
    return null;
  }
}
```

---

## Step 2 — Add `runPolicyUpdate` utility

Create `src/utils/policy-update.utils.ts`:

```ts
import { execa } from 'execa';
import { findManagedPath } from './managed.utils.js';

const DEPS_POLICY_NAME = '@finografic/deps-policy';

/**
 * Runs `pnpm policy:update` in the local deps-policy repo.
 * @param silent - When true, passes --yes and suppresses output (for --managed).
 * @returns true if the update ran, false if deps-policy was not found in managed config.
 */
export async function runPolicyUpdate(silent: boolean): Promise<boolean> {
  const depsPolicyPath = await findManagedPath(DEPS_POLICY_NAME);
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

- `stdio: 'inherit'` for interactive mode — lets clack prompts render correctly in the terminal
- `stdio: 'pipe'` for silent mode — suppresses all output (--yes produces minimal output anyway)
- If deps-policy is not in managed, skip silently — do not error

---

## Step 3 — `genx deps --update-policy`

In `src/commands/deps.cli.ts`:

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
      `@finografic/deps-policy not found in managed config.\nAdd it to ${pc.cyan(GENX_CONFIG_PATH)} to use --update-policy.`,
    );
    process.exit(1);
  }
  return;
}
```

---

## Step 4 — `genx deps --managed` silent pre-update

In the `if (managed)` block, **before** the `readManagedTargets()` call, add:

```ts
// Silently update deps-policy first so the freshest versions are used for all targets.
await runPolicyUpdate(true);
```

No error if deps-policy is not in managed — `runPolicyUpdate` returns false and execution continues normally.

---

## Step 5 — Update help (`src/help/deps.help.ts`)

Add to the `examples.list` array:

```ts
{
  label: 'Update deps-policy interactively, then stop',
  description: 'genx deps --update-policy',
},
{
  label: 'Update policy silently, then sync all managed targets',
  description: 'genx deps --managed --write',
},
```

Update `main.args` to reflect the new flag:

```ts
args: '[path] [--update-policy] [options]',
```

---

## Step 6 — Add `@finografic/deps-policy` to managed config

The user must add it manually (one-time):

```json
// ~/.config/finografic/genx.config.json
{
  "managed": [
    {
      "name": "@finografic/deps-policy",
      "path": "/Users/justin/repos-finografic/_@finografic-deps-policy"
    }
  ]
}
```

Note the underscore-prefixed directory name for deps-policy.
This is a user config — not committed to the repo.

---

## Step 7 — Verify

```bash
pnpm typecheck    # zero errors

# Test --update-policy (interactive)
genx deps --update-policy
# → should show clack prompts from policy:update in terminal

# Test --managed (silent pre-update)
genx deps --managed --write
# → no policy prompts, proceeds directly to managed target loop
# → versions used are from freshly-written XDG snapshot
```

---

## Step 8 — Commit

```
feat(deps): add --update-policy flag and silent policy pre-update for --managed
```
