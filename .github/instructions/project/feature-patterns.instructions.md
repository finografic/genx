# Feature Development Patterns (`@finografic/genx`)

These rules apply when adding or modifying features in `src/features/`. Each feature lives in its own subfolder and follows a consistent file structure. Not every feature needs every file — use judgment.

## Folder Structure

```
src/features/{feature}/
  README.md                # Required — appears as a section in the root README
  {feature}.constants.ts   # All constants for the feature
  {feature}.detect.ts      # Detection: is this feature already installed?
  {feature}.feature.ts     # Feature definition: exports the Feature object
  {feature}.apply.ts       # Apply logic: installs/configures the feature
  {feature}.vscode.ts      # VSCode-specific logic (only if needed)
```

## `README.md` (required)

Every feature folder **must** include a `README.md`. These are rendered as sections in the root `README.md` via `pnpm docs.usage`.

Structure:

```markdown
# {feature}

One-line description of what the feature provides.

## What it does

- Bullet list of side effects (installs, creates, configures)

## Files

| File                     | Purpose |
| ------------------------ | ------- |
| `{feature}.constants.ts` | ...     |
| ...                      | ...     |

## VSCode Extension ← only if applicable

`publisher.extension-id`
```

## `{feature}.constants.ts`

- Export all magic strings, versions, file paths, and config values used by the feature.
- VSCode extension IDs are `readonly` arrays, even for a single entry:

```ts
export const MY_VSCODE_EXTENSIONS = ['publisher.extension-id'] as const;
```

- Never define extension IDs as plain strings — always arrays.

## `{feature}.detect.ts`

- Export a single `detect{Feature}(context: FeatureContext): boolean | Promise<boolean>`.
- Use `fileExists` from `'utils'` (barrel import, never `'utils/fs.utils'` or raw `existsSync`).
- Keep detection lightweight — check for a config file or a key dependency, not exhaustive state.

## `{feature}.feature.ts`

- Export a single `const` that satisfies `Feature` from `'../feature.types'`.
- Assign `vscode.extensions` directly from the constants array (no spread needed):

```ts
vscode: {
  extensions: MY_VSCODE_EXTENSIONS,
},
```

- Register the feature in `src/features/feature-registry.ts`.

## `{feature}.apply.ts`

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

## `{feature}.vscode.ts`

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

## Import Conventions

- Always import from the barrel `'utils'`, never from deep paths like `'utils/fs.utils'`.
- Group imports: `node:*` → `'utils'` → `'config/*'` → `'types/*'` → local (`'../...'`, `'./'`).
