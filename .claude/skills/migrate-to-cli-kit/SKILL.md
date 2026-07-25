---
name: migrate-to-cli-kit
description: Migrate a @finografic CLI project from inline src/core/ copies to @finografic/cli-kit subpath imports, replace path-building with xdg helpers, and make readConfig/writeConfig async. Use when a CLI project still carries its own src/core/flow/, src/core/render-help/, or manual XDG path constants.
trigger: User asks to migrate a CLI project to cli-kit, replace src/core/ with cli-kit, or wire @finografic/cli-kit into a project
tools: [file-read, file-edit, terminal]
---

# Migrate a CLI project to `@finografic/cli-kit`

`@finografic/cli-kit` centralises the shared primitives that used to be copied across every `@finografic` CLI project. This skill performs the full migration in one pass.

## What cli-kit provides (relevant subpaths)

| Subpath                           | Replaces                                                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `@finografic/cli-kit/flow`        | `src/core/flow/` (`createFlowContext`, `promptConfirm`, `FlowContext`, …)                                |
| `@finografic/cli-kit/render-help` | `src/core/render-help/` (`renderHelp`, `renderCommandHelp`, `HelpConfig`, …)                             |
| `@finografic/cli-kit/xdg`         | Manual XDG path constants + sync fs helpers (`getConfigPath`, `getCachePath`, `readJsonc`, `writeJsonc`) |

Full export list: `@finografic/cli-kit/commands`, `/file-diff`, `/paths`, `/prompts`, `/tui`, `/package-manager` — check `src/index.ts` in the cli-kit repo for the latest.

## Pre-flight

1. Confirm the project has `@finografic:registry=https://npm.pkg.github.com` in `.npmrc`.
2. Check what `src/core/` contains — not all projects have all three modules.
3. Check whether the project has a `readConfig`/`writeConfig` pair in `utils/config.utils.ts` or equivalent. If yes, the async migration below applies.

---

## Step 1 — Install

```bash
pnpm add @finografic/cli-kit
```

---

## Step 2 — Remove `core/*` from `tsconfig.json`

Find the `paths` block and delete the `"core/*"` entry:

```jsonc
// Before
"core/*": ["./src/core/*"],

// After — delete the line entirely
```

---

## Step 3 — Replace XDG path constants

If the project has `src/config/paths.constants.ts` (or equivalent) that manually builds XDG paths:

```ts
// Before
import { homedir } from 'node:os';
import { join } from 'node:path';
export const CONFIG_PATH = join(process.env['XDG_CONFIG_HOME'] || join(homedir(), '.config'), '<app>');
export const CONFIG_FILE = join(CONFIG_PATH, 'config.json');
export const CACHE_FILE  = join(CONFIG_PATH, 'cache.json');

// After
import { join } from 'node:path';
import { getConfigPath } from '@finografic/cli-kit/xdg';
export const CONFIG_PATH = getConfigPath('<app>');   // honours XDG_CONFIG_HOME
export const CONFIG_FILE = join(CONFIG_PATH, 'config.json');
export const CACHE_FILE  = join(CONFIG_PATH, 'cache.json');
```

> `getCachePath('<app>')` returns `~/.cache/<app>` — only use it if the project intentionally separates config and cache directories. If both currently live under `~/.config/<app>`, keep using `getConfigPath` for both to avoid breaking existing installs.

---

## Step 4 — Migrate `config.utils.ts` to async

This is the most impactful change. Replace the sync `fs` reads/writes with `readJsonc`/`writeJsonc` from cli-kit:

```ts
// Before (sync)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { CONFIG_FILE, CONFIG_PATH } from 'config/paths.constants.js';

export function writeConfig({ config }: { config: AppConfig }): void {
  mkdirSync(CONFIG_PATH, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

export function readConfig(): AppConfig {
  if (!existsSync(CONFIG_FILE)) {
    writeConfig({ config: FULL_DEFAULT_CONFIG });
    return { ...FULL_DEFAULT_CONFIG };
  }
  // ... parse, validate, return
}

// After (async) — cli-kit's writeJsonc handles mkdir internally
import { join } from 'node:path';
import { getConfigPath, readJsonc, writeJsonc } from '@finografic/cli-kit/xdg';

const CONFIG_FILE = join(getConfigPath('<app>'), 'config.json');

export async function writeConfig({ config }: { config: AppConfig }): Promise<void> {
  await writeJsonc(CONFIG_FILE, config);
}

export async function readConfig(): Promise<AppConfig> {
  const parsed = await readJsonc<unknown>(CONFIG_FILE);

  if (parsed === null) {
    // First run — persist defaults
    await writeConfig({ config: FULL_DEFAULT_CONFIG });
    return { ...FULL_DEFAULT_CONFIG };
  }

  if (!isValidConfig(parsed)) return { ...FULL_DEFAULT_CONFIG };
  return parsed as AppConfig;
}
```

Keep project-specific logic (type validation, legacy field migration, `FULL_DEFAULT_CONFIG`) in the local file — only the read/write mechanics move to cli-kit.

---

## Step 5 — Ripple `await` through all callers of `readConfig`/`writeConfig`

`readConfig` is now async. Every call site needs `await`. Find them all:

```bash
grep -rn "readConfig()\|writeConfig(" src/
```

For each result:

- Add `await` before the call
- Ensure the enclosing function is `async` (add `async`/change return type to `Promise<…>` if needed)

**Common patterns and their fixes:**

| Before                         | After                                       |
| ------------------------------ | ------------------------------------------- |
| `const config = readConfig();` | `const config = await readConfig();`        |
| `writeConfig({ config });`     | `await writeConfig({ config });`            |
| `function runList(): void {`   | `async function runList(): Promise<void> {` |

**Keypress / event handlers** — if `readConfig` is called inside a sync event handler (e.g. stdin `data`), make the handler function async and use `void` at the call site:

```ts
// Sync event handler calling async function
process.stdin.on('data', (key) => {
  void renderFromCache();   // fire-and-forget is fine here
});
```

---

## Step 6 — Swap `core/flow/` imports

Replace every import from `core/flow/` with `@finografic/cli-kit/flow`:

```ts
// Before
import { createFlowContext, promptConfirm } from 'core/flow/index.js';
import type { FlowContext } from 'core/flow/index.js';

// After
import { createFlowContext, promptConfirm } from '@finografic/cli-kit/flow';
import type { FlowContext } from '@finografic/cli-kit/flow';
```

Find all occurrences:

```bash
grep -rn "from 'core/flow/" src/
```

---

## Step 7 — Swap `core/render-help/` imports

```ts
// Before
import { renderHelp, renderCommandHelp } from 'core/render-help/index.js';
import type { HelpConfig } from 'core/render-help/index.js';

// After
import { renderHelp, renderCommandHelp } from '@finografic/cli-kit/render-help';
import type { HelpConfig } from '@finografic/cli-kit/render-help';
```

Find all occurrences:

```bash
grep -rn "from 'core/render-help/" src/
```

---

## Step 8 — Typecheck

```bash
pnpm typecheck
```

Fix any errors before proceeding. Common issues:

- Forgot `await` on a `readConfig()` call
- A function that calls `readConfig` is now implicitly async but not declared as such
- `listRepos()` (or equivalent wrapper) returns `Promise<T[]>` — every call site that uses `.length` or `.map` directly on the result needs `await`

---

## Step 9 — Delete `src/core/`

Once typecheck passes with zero errors:

```bash
rm -rf src/core/
pnpm typecheck   # confirm still clean
```

---

## Step 10 — Commit

```bash
git add -A
git commit -m "refactor: migrate core primitives to @finografic/cli-kit"
```

Suggested commit body:

```
- Add @finografic/cli-kit dependency
- Replace src/core/flow/ → @finografic/cli-kit/flow
- Replace src/core/render-help/ → @finografic/cli-kit/render-help
- Replace XDG path constants → @finografic/cli-kit/xdg getConfigPath
- readConfig/writeConfig now async via readJsonc/writeJsonc
- Ripple await through all callers
- Delete src/core/; remove core/* tsconfig path alias
```

---

## Notes on project variation

- **No `src/core/flow/`** — skip Steps 6. Only swap render-help if that's what's inline.
- **No `config.utils.ts`** — skip Steps 3–5. The xdg migration is only needed if the project manages XDG paths itself.
- **`cache.utils.ts` with sync reads** — leave it sync if the cache is read in hot/sync paths (e.g. a display render loop). `writeJsonc` is only needed for the config file, not necessarily every file the project writes.
- **`paths.constants.ts` still imported by `cache.utils.ts`** — keep the file if `cache.utils.ts` imports from it; just swap its internals to use `getConfigPath` as shown in Step 3.
