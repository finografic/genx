# Core Module Patterns (`@finografic` CLI projects)

These rules apply when adding or modifying modules in `src/core/` in any `@finografic` CLI project. The canonical spec is **`docs/spec/CLI_CORE.md`** in the `@finografic/genx` repository.

For the step-by-step agent workflow, see `.github/skills/scaffold-core-module/SKILL.md`.

## What is `src/core/`?

`src/core/` is the **portable infrastructure layer** — modules that are identical across all `@finografic` CLI projects. They are kept in sync by convention, not by a package manager.

> **AVOID EDITING `src/core/` FILES DIRECTLY** unless you intend to propagate the same change to all repos. Treat a `core/` edit the same as editing a shared dependency.

## Module Folder Structure

```
src/core/
  {module-name}/
    {module-name}.utils.ts    # Implementation
    {module-name}.types.ts    # Types (if separated from utils)
    index.ts                  # Barrel — the only public API surface
    {module-name}.test.ts     # Co-located tests (if applicable)
```

## Rules

### Required

- `index.ts` is required in every module. All external consumers import through the barrel only.
- Types co-located with implementation — never in `src/types/`.
- One responsibility per module.
- No side effects on import (only `const` value initialization is allowed at module load time).
- No imports from repo-specific path aliases (`utils/*`, `config/*`, `commands/*`, `types/*`). Only `node:*` builtins and `node_modules` packages.

### Functions

- Top-level functions use the `function` keyword, not `const`:

  ```ts
  // correct
  export function renderHelp(config: HelpConfig): void { ... }

  // wrong
  export const renderHelp = (config: HelpConfig): void => { ... }
  ```

- All exported functions must have explicit return types.
- Internal helpers should also have explicit return types.

### Exports

- Named exports only — no default exports.
- Barrel `index.ts` re-exports using named export syntax.

### Imports within a module

- Relative imports within a module use `.js` extension:

  ```ts
  import type { HelpConfig } from './help.types.js';
  ```

### Picocolors

```ts
import pc from 'picocolors';
```

Never use the `utils/picocolors` ESM interop wrapper from within `core/`.

### Header comment

All implementation files (`*.utils.ts`) must begin with:

```ts
// ⚠️ AVOID EDITING THIS FILE DIRECTLY — changes must be propagated to all @finografic CLI repos
```

## Consuming from Application Code

Add the `core/*` path alias to `tsconfig.json`:

```json
"paths": {
  "core/*": ["./src/core/*"]
}
```

Always import through the barrel:

```ts
import { renderHelp } from 'core/render-help';
import type { HelpConfig } from 'core/render-help';
import { createFlowContext } from 'core/flow';
```

With `verbatimModuleSyntax` (gli-style):

```ts
import { renderHelp } from 'core/render-help/index.js';
```

## Current Modules

| Module              | Purpose                                                     |
| ------------------- | ----------------------------------------------------------- |
| `core/flow/`        | Typed adapter over `@clack/prompts`: flag parsing + prompts |
| `core/render-help/` | CLI help types (`HelpConfig`) + `renderHelp()` renderer     |

## Checklist for a New Module

- [ ] Useful in more than one `@finografic` CLI project
- [ ] No imports from repo-specific aliases
- [ ] No side effects on import
- [ ] Single clear responsibility
- [ ] `index.ts` barrel created
- [ ] `⚠️ AVOID EDITING` header in implementation files
- [ ] `core/*` path alias in `tsconfig.json`
- [ ] Module documented in `docs/spec/CLI_CORE.md` (genx)
- [ ] Module propagated to all other `@finografic` CLI repos
