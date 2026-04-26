# DONE — XDG-first policy loader in genx

> **Status:** Complete — 2026-04-26
>
> Committed as `ba9c9ae` in genx, `71e84e1` in deps-policy.

Make genx read dep versions from `~/.config/finografic/deps-policy.config.json` when it exists,
falling back to the installed `@finografic/deps-policy` from node_modules. This removes the
publish → install cycle for local dev: run `pnpm policy:update` in the deps-policy repo and
genx picks up the new versions immediately on the next invocation.

---

## Background

`@finografic/deps-policy` now ships a `snapshot` command that writes a JSON file:

```
~/.config/finografic/deps-policy.config.json
```

The file shape (abbreviated):

```jsonc
{
  "_meta": { "package": "@finografic/deps-policy", "version": "0.15.8", "generatedAt": "..." },
  "base": { "devDependencies": { "typescript": "5.9.3", ... } },
  "cli": { "dependencies": { "picocolors": "^1.1.1" } },
  "library": { ... },
  "config": { ... }
}
```

It currently does **not** include `formatting` or `linting` as top-level keys — see step 1 below.

---

## Steps

### Step 1 — Add `formatting` and `linting` to the snapshot (deps-policy repo)

File: `src/deps-cli/commands/snapshot/snapshot.cli.ts`

Import the named groups from `base.deps.ts` and include them in the snapshot object:

```ts
import { base, formatting, linting } from 'policy/base.deps.js';
import { cli } from 'policy/cli.deps.js';
import { config } from 'policy/config.deps.js';
import { library } from 'policy/library.deps.js';

const snapshot = {
  _meta: { ... },
  base,
  cli,
  library,
  config,
  formatting,
  linting,
};
```

Check `src/policy/index.ts` to confirm the exact export names (`formatting`, `linting`).

After editing, run `pnpm policy:snapshot` to regenerate the local XDG file, then commit in the
deps-policy repo. Release a new patch version (`pnpm policy:release:patch`) so the snapshot format
is canonical before wiring genx.

---

### Step 2 — Create `src/config/policy.ts` in genx

This is the single new file that loads policy at startup — all existing import sites point here
instead of directly to `@finografic/deps-policy`.

```ts
// src/config/policy.ts
import { createXdgPaths, readJsonc } from '@finografic/cli-kit/xdg';
import type { DependencyGroup } from '@finografic/deps-policy/deps.types';

interface PolicySnapshot {
  _meta: { package: string; version: string; generatedAt: string };
  base: DependencyGroup;
  cli: DependencyGroup;
  library: DependencyGroup;
  config: DependencyGroup;
  formatting: Record<string, string>;
  linting: Record<string, string>;
}

const xdg = createXdgPaths();
const xdgSnapshot = await readJsonc<PolicySnapshot>(xdg.configPath('deps-policy'));

// Prefer XDG snapshot (local dev); fall back to installed package (CI / no snapshot).
const installed = await import('@finografic/deps-policy');

export const policy = xdgSnapshot
  ? { base: xdgSnapshot.base, cli: xdgSnapshot.cli, library: xdgSnapshot.library, config: xdgSnapshot.config }
  : installed.policy;

export const formatting: Record<string, string> = xdgSnapshot?.formatting ?? installed.formatting ?? {};
export const linting: Record<string, string>    = xdgSnapshot?.linting    ?? installed.linting    ?? {};
```

Notes:

- Uses top-level `await` — valid in ESM, which genx already uses.
- `readJsonc` returns `null` when the file is absent, so the fallback is always safe.
- The XDG snapshot version is not validated against `node_modules` — intentional. Local dev may
  be ahead of the published version.

---

### Step 3 — Update all import sites (6 files)

Replace every `import { ... } from '@finografic/deps-policy'` with an import from `config/policy.js`.

| File                                                                   | Current import                   | What to change                                             |
| ---------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------- |
| `src/config/dependencies.rules.ts`                                     | `import { policy }`              | → `import { policy } from 'config/policy.js'`              |
| `src/features/vitest/vitest.constants.ts`                              | `import { policy }`              | → `import { policy } from 'config/policy.js'`              |
| `src/features/markdown/markdown.constants.ts`                          | `import { policy }`              | → `import { policy } from 'config/policy.js'`              |
| `src/features/oxc-config/oxc-config.preview.canonical-package-json.ts` | `import { formatting, linting }` | → `import { formatting, linting } from 'config/policy.js'` |
| `src/commands/create.cli.ts`                                           | `import { policy }`              | → `import { policy } from 'config/policy.js'`              |
| `src/commands/migrate.cli.ts`                                          | `import { policy }`              | → `import { policy } from 'config/policy.js'`              |

No other changes needed in those files — the `policy`, `formatting`, and `linting` shapes are
identical to what the installed package exports.

---

### Step 4 — Verify

```bash
pnpm typecheck          # must be zero errors
pnpm build              # must complete cleanly
```

Then run `genx deps` against a target project and confirm it applies the versions from the local
snapshot rather than the installed package version (temporarily bump a version in a policy source
file and check the XDG file updates, then verify genx uses the bumped value).

---

### Step 5 — Commit

```
feat(policy): load dep versions from XDG snapshot when available
```

---

## What this does NOT change

- `self-update.utils.ts` — this checks the _published_ npm version to prompt for a genx update.
  That flow is intentionally separate and should stay as-is.
- The installed `@finografic/deps-policy` in `node_modules` — still the fallback and still used in CI.
- The release workflow for deps-policy — still needed when publishing to GitHub Packages for CI/team.
