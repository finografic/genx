# Feature Development Patterns (`@finografic/genx`)

These rules apply when adding or modifying features in `src/features/`. Each feature lives in its own subfolder and follows a consistent file structure.

## Quick Start

To scaffold a new feature with all skeleton files and registry wiring:

```bash
pnpm new.feature
```

This runs the interactive scaffolding script. For the full procedural guide (including manual steps), see `.github/skills/scaffold-feature/SKILL.md`.

## Folder Structure

```
src/features/{folder-name}/
  README.md                    # Required — appears as a section in the root README
  {folder-name}.constants.ts   # All constants for the feature
  {folder-name}.detect.ts      # Detection: is this feature already installed?
  {folder-name}.feature.ts     # Feature definition: exports the Feature object
  {folder-name}.apply.ts       # Apply logic: installs/configures the feature
  {folder-name}.vscode.ts      # VSCode-specific logic (only if needed)
```

**Naming:** The feature ID is camelCase (e.g. `gitHooks`), the folder name is kebab-case (e.g. `git-hooks`). File names use the folder name.

### When to add optional files

- **`{folder-name}.vscode.ts`** — Create if the feature adds VSCode extension recommendations or modifies `.vscode/settings.json`. Do not create otherwise.
- **`{folder-name}.template.ts`** — Create if the feature copies template files from `_templates/` and needs to define template content or paths.
- **`{folder-name}.test.ts`** — Co-located tests are encouraged but not scaffolded by default. Add when the feature has non-trivial logic worth covering (especially detect and apply).

## `README.md` (required)

Every feature folder **must** include a `README.md`. These are rendered as sections in the root `README.md` via `pnpm docs.usage`.

Structure:

```markdown
# {Feature Label}

One-line description of what the feature provides.

## What it does

- Bullet list of side effects (installs, creates, configures)

## Files

| File                         | Purpose |
| ---------------------------- | ------- |
| `{folder-name}.constants.ts` | ...     |
| ...                          | ...     |

## VSCode Extension ← only if applicable

`publisher.extension-id`
```

## `{folder-name}.constants.ts`

- Export all magic strings, versions, file paths, and config values used by the feature.
- VSCode extension IDs are `readonly` arrays, even for a single entry:

```ts
export const MY_VSCODE_EXTENSIONS = ['publisher.extension-id'] as const;
```

- Never define extension IDs as plain strings — always arrays.
- Constants are the single source of truth — apply and detect import from constants, never define their own magic strings.

## `{folder-name}.detect.ts`

- Export a single `detect{Feature}(context: FeatureContext): boolean | Promise<boolean>`.
- Use `fileExists` from `'utils'` (barrel import, never `'utils/fs.utils'` or raw `existsSync`).
- Keep detection lightweight — check for ONE reliable indicator (a config file or a key dependency), not exhaustive state.
- Must be side-effect-free. No writes, no installs, no network calls.

## `{folder-name}.feature.ts`

- Export a single `const` that satisfies `Feature` from `'../feature.types'`.
- Assign `vscode.extensions` directly from the constants array (no spread needed):

```ts
vscode: {
  extensions: MY_VSCODE_EXTENSIONS,
},
```

### The `hint` field

The `hint` property shows alongside the label in the multi-select prompt:

| Value           | When to use                                      |
| --------------- | ------------------------------------------------ |
| `'recommended'` | Feature should be pre-selected for most projects |
| `'optional'`    | Useful but not expected by default               |
| `undefined`     | Neutral — no hint shown                          |

### Registry wiring

After creating the feature file, wire it in two places:

1. **`src/features/feature.types.ts`** — Add the feature ID to the `FeatureId` union type. Maintain alphabetical order.

2. **`src/features/feature-registry.ts`** — Add the import (alphabetical by variable name) and add the feature to the `features` array (same order as imports).

```ts
// In feature-registry.ts
import { myFeatureFeature } from './my-feature/my-feature.feature';

export const features: Feature[] = [
  // ... existing features ...
  myFeatureFeature,
];
```

The `pnpm new.feature` script handles both of these automatically.

## `{folder-name}.apply.ts`

- Export a single `apply{Feature}(context: FeatureContext): Promise<FeatureApplyResult>`.
- Collect all changes in a local `const applied: string[] = []` and push descriptive strings as each step succeeds.
- Number each logical step with an inline comment:

```ts
// 1. Install the package
// 2. Create the config file
// 3. Add scripts to package.json
// 4. Update .gitignore
// 5. Configure VSCode
```

- Use step `0.` for auto-dependencies that must run before the feature's own steps.
- End with:

```ts
if (applied.length === 0) {
  return { applied, noopMessage: 'Feature already configured. No changes made.' };
}
return { applied };
```

- Import `fileExists` from `'utils'`, not `existsSync` from `node:fs`.
- For features that copy template files, use `createDefaultTemplateVars()` from `'../feature.utils'`.
- **Apply must be idempotent** — running it twice should produce the same result. Always check before modifying.

## `{folder-name}.vscode.ts`

- All VSCode operations for the feature live here — extension recommendations, settings, formatter config.
- Do **not** call `addExtensionRecommendations` or `addLanguageFormatterSettings` from `*.apply.ts` — wrap them here instead:

```ts
export async function apply{Feature}Extensions(targetDir: string): Promise<string[]> {
  return addExtensionRecommendations(targetDir, [...MY_VSCODE_EXTENSIONS]);
}
```

- Only create this file if the feature touches `.vscode/`.

## Shared Utilities

- `fileExists(path)` — `'utils'` barrel, wraps `existsSync`. Use everywhere instead of raw `existsSync`.
- `createDefaultTemplateVars()` — `'../feature.utils'`. Use when copying template files.
- `addExtensionRecommendations`, `addLanguageFormatterSettings`, `readSettingsJson`, `writeSettingsJson` — `'utils'`. Only call from `*.vscode.ts`.
- `isDependencyDeclared`, `installDevDependency`, `removeDependency` — `'utils'`. Call from `*.apply.ts`.
- `spinner`, `successMessage`, `errorMessage`, `infoMessage` — `'utils'`. For user feedback in apply.

## Import Conventions

- Always import from the barrel `'utils'`, never from deep paths like `'utils/fs.utils'`.
- Group imports: `node:*` → `'utils'` → `'config/*'` → `'types/*'` → local (`'../...'`, `'./'`).

## Testing

- Co-locate test files as `{folder-name}.test.ts` within the feature folder.
- Prioritise testing detect (should return correct boolean) and apply (should be idempotent, should populate `applied` array correctly).
- Use Vitest conventions — `describe`, `it`, `expect`.
