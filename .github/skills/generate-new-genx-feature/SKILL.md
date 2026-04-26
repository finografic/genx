---
name: scaffold-feature
description: Scaffold a new feature module for @finografic/genx. Creates the full feature folder structure (feature, apply, detect, constants, README), wires the registry, and updates the FeatureId type. Use when the user asks to add a new feature to genx.
trigger: User asks to add, create, or scaffold a new feature in genx
tools: [file-create, file-edit, terminal]
---

# Scaffold a New Feature Module

This skill creates a complete feature module for `@finografic/genx` following the established feature pattern. It can be run via `pnpm dev:feature` (interactive) or executed manually by an agent.

Before proceeding, read the feature patterns instruction file at `.github/instructions/project/feature-patterns.instructions.md` — it defines the conventions this skill implements.

## Prerequisites

- You are working in the `@finografic/genx` repository
- You know the feature's **id** (camelCase, e.g. `tailwind`), **label** (display name), and **purpose**

## Step 1 — Validate the Feature ID

The feature ID must be:

- camelCase (e.g. `tailwind`, `gitHooks`, `aiClaude`)
- Unique — not already present in `src/features/feature.types.ts` under the `FeatureId` union
- The folder name uses kebab-case derived from the id (e.g. `gitHooks` → `git-hooks`, `aiClaude` → `ai-claude`)

Check `src/features/feature.types.ts` to confirm the ID is not taken.

## Step 2 — Run the Scaffolding Script (preferred)

```bash
pnpm dev:feature
```

This creates all skeleton files and wires the registry. After it completes, skip to **Step 6**.

If the script is unavailable or you're working manually, continue with Steps 3–5.

## Step 3 — Create the Feature Folder

Create `src/features/__FOLDER_NAME__/` with these files:

### `__FOLDER_NAME__.feature.ts`

```ts
import type { Feature } from '../feature.types';
import { apply__FEATURE_PASCAL__ } from './__FOLDER_NAME__.apply';
import { audit__FEATURE_PASCAL__, detect__FEATURE_PASCAL__ } from './__FOLDER_NAME__.detect';

export const __FEATURE_ID__Feature: Feature = {
  id: '__FEATURE_ID__',
  label: '__FEATURE_LABEL__',
  hint: undefined, // Set to 'recommended' if this should be pre-selected
  detect: detect__FEATURE_PASCAL__,
  audit: audit__FEATURE_PASCAL__,
  apply: apply__FEATURE_PASCAL__,
};
```

### `__FOLDER_NAME__.detect.ts`

```ts
import type { AuditResult, FeatureContext } from '../feature.types';

/**
 * Detect if __FEATURE_LABEL__ is already configured.
 */
export async function detect__FEATURE_PASCAL__(context: FeatureContext): Promise<boolean> {
  // TODO: Check for config file, key dependency, or marker
  // Use fileExists() from 'utils' or isDependencyDeclared() from 'utils'
  return false;
}

/**
 * Tri-state audit: 'installed' | 'partial' | 'missing'.
 * partial = primary indicator present (package in devDeps / primary file exists) but not fully configured.
 */
export async function audit__FEATURE_PASCAL__(context: FeatureContext): Promise<AuditResult> {
  const installed = await detect__FEATURE_PASCAL__(context);
  if (installed) return { status: 'installed' };
  // TODO: check primary indicator (e.g. isDependencyDeclared / fileExists)
  // const hasPkg = await isDependencyDeclared(context.targetDir, PRIMARY_PACKAGE);
  // return hasPkg ? { status: 'partial', detail: 'config out of date' } : { status: 'missing' };
  return { status: 'missing' };
}
```

### `__FOLDER_NAME__.apply.ts`

For preview-driven features (the standard pattern — see `scaffold-feature-preview` skill):

```ts
import type { FeatureApplyResult, FeatureContext } from '../feature.types';

import { applyPreviewChanges } from '../../lib/feature-preview/index.js';
import { preview__FEATURE_PASCAL__ } from './__FOLDER_NAME__.preview.js';

/**
 * Apply __FEATURE_LABEL__ using preview-driven apply. Passes `context.yesAll` so that
 * `genx audit -y` skips per-file confirmation prompts.
 */
export async function apply__FEATURE_PASCAL__(context: FeatureContext): Promise<FeatureApplyResult> {
  const preview = await preview__FEATURE_PASCAL__(context);
  return applyPreviewChanges(preview, { yesAll: context.yesAll });
}
```

> **Mandatory:** always pass `{ yesAll: context.yesAll }` as the second argument to `applyPreviewChanges`.
> This ensures `genx audit -y` (and any future yes-mode caller) skips per-file prompts end-to-end.

For features that cannot use the preview pattern and write directly:

```ts
import type { FeatureApplyResult, FeatureContext } from '../feature.types';

/**
 * Apply __FEATURE_LABEL__ to the target project.
 */
export async function apply__FEATURE_PASCAL__(context: FeatureContext): Promise<FeatureApplyResult> {
  const applied: string[] = [];

  // 1. Install dependencies
  // TODO

  // 2. Create/update config files
  // TODO: respect context.yesAll — skip confirmation prompts when true

  // 3. Update package.json scripts (if needed)
  // TODO

  if (applied.length === 0) {
    return { applied, noopMessage: '__FEATURE_LABEL__ already configured. No changes made.' };
  }

  return { applied };
}
```

### `__FOLDER_NAME__.constants.ts`

```ts
/**
 * __FEATURE_LABEL__ feature constants.
 */

// TODO: Add package names, versions, config values, VSCode extensions
```

### `README.md`

```markdown
# **FEATURE_LABEL**

One-line description of what this feature provides.

## What it does

- TODO: List side effects (installs, creates, configures)

## Files

| File                           | Purpose                                |
| ------------------------------ | -------------------------------------- |
| `__FOLDER_NAME__.constants.ts` | Package names, versions, config values |
| `__FOLDER_NAME__.detect.ts`    | Checks if feature is already installed |
| `__FOLDER_NAME__.feature.ts`   | Feature definition and metadata        |
| `__FOLDER_NAME__.apply.ts`     | Installation and configuration logic   |
```

## Step 4 — Wire the Registry

In `src/features/feature-registry.ts`:

1. Add the import (maintain alphabetical order by feature variable name):

   ```ts
   import { __FEATURE_ID__Feature } from './__FOLDER_NAME__/__FOLDER_NAME__.feature';
   ```

2. Add to the `features` array (order should match import order).

## Step 5 — Update the FeatureId Type

In `src/features/feature.types.ts`, add the new ID to the `FeatureId` union:

```ts
export type FeatureId =
  | 'oxfmt'
  // ... existing entries ...
  | '__FEATURE_ID__';
```

Maintain alphabetical order within the union.

## Step 6 — Verify

Run these commands to confirm everything compiles:

```bash
pnpm typecheck
pnpm build
```

If either fails, check:

- Import paths use `.js` extension for local imports (ESM convention)
- The `FeatureId` union includes the new ID
- The feature export name matches what `feature-registry.ts` imports

## Step 7 — Implement the Feature

Now fill in the skeleton:

1. **Constants first** — define all package names, versions, file paths, and config objects. Never use magic strings in other files.

2. **Detect** — keep it lightweight. Check for ONE reliable indicator:
   - A config file (e.g. `tailwind.config.ts`)
   - A key dependency in `package.json` (use `isDependencyDeclared` from `'utils'`)
   - Do NOT do exhaustive checks — detect should be fast and side-effect-free.

3. **Apply** — follow the numbered-step pattern. Each step should:
   - Check before acting (idempotent)
   - Push a descriptive string to `applied[]` on success
   - Use utilities from the `'utils'` barrel (never deep imports)
   - **Logging:** when you emit an immediate, user-visible success line during apply (not only entries in `applied[]`), import `successMessage`, `successUpdatedMessage`, and `successRemovedMessage` from `'utils'` and choose by **kind of change**:
     - **`successMessage`** — new work (created file, new script, installed package) — green.
     - **`successUpdatedMessage`** — modified existing files in place — cyan; prefer **“Updated …”** copy.
     - **`successRemovedMessage`** — removed deps, deleted legacy config, or removal-style cleanup — yellow; prefer **“Removed …”** (or **“Backed up …”** when replacing) copy.
       See `.github/instructions/project/feature-patterns.instructions.md` (**Shared Utilities**) for the full table. Reference implementations: `src/features/oxfmt/oxfmt.apply.ts`, `src/features/markdown/markdown.apply.ts`.

4. **VSCode** (optional) — only create `__FOLDER_NAME__.vscode.ts` if the feature needs VSCode extensions or settings. Wrap `addExtensionRecommendations` / `addLanguageFormatterSettings` here — never call them directly from apply.

5. **README** — update with the actual behavior once implementation is complete.

## Design Decisions

- **Constants are the source of truth** — apply and detect import from constants, never define their own magic strings.
- **Detect is cheap** — one filesystem check or one dependency lookup. No network calls, no parsing.
- **Apply is idempotent** — running it twice should produce the same result. Always check before modifying.
- **`yesAll` is mandatory** — always pass `{ yesAll: context.yesAll }` to `applyPreviewChanges`. This lets `genx audit -y` skip all per-file prompts without feature-specific changes.
- **`audit()` is mandatory** — implement tri-state detection (`installed | partial | missing`) in `*.detect.ts`. `partial` = primary indicator present but preview still has changes. Without it the audit command can only show `installed | missing`.
- **VSCode concerns are isolated** — if a feature doesn't touch `.vscode/`, it doesn't need a `.vscode.ts` file.
- **Barrel imports only** — import from `'utils'`, not from `'utils/fs.utils'`.
