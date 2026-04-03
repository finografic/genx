# CLI Help Patterns (`@finografic` CLI projects)

These rules apply when defining or modifying root-level help output for any `@finografic` CLI tool. The canonical spec for `core/render-help` and related patterns is **`docs/spec/CLI_CORE.md`** in the `@finografic/genx` repository.

For the step-by-step agent workflow, see `.github/skills/scaffold-cli-help/SKILL.md`.

## Overview

All `@finografic` CLI projects define their root help as a typed `HelpConfig` object in `src/cli.help.ts`, rendered by `renderHelp()` from `core/render-help`.

## File Locations

| File                    | Purpose                                       |
| ----------------------- | --------------------------------------------- |
| `src/cli.help.ts`       | Declares the `HelpConfig` object for this CLI |
| `src/cli.ts`            | Imports and calls `renderHelp(cliHelp)`       |
| `src/core/render-help/` | Shared renderer — do not edit directly        |

## `src/cli.help.ts` Structure

```ts
import type { HelpConfig } from 'core/render-help';

export const cliHelp: HelpConfig = {
  main: {
    bin: 'BINARY_NAME', // e.g. 'genx', 'gli'
    args: '<command> [options]',
  },
  commands: {
    title: 'Commands',
    list: [{ label: 'COMMAND', description: 'One-line description' }],
    options: {
      labels: { minWidth: 8 }, // optional — align label column width
    },
  },
  examples: {
    title: 'Examples',
    list: [{ label: 'Human-readable description', description: 'actual-command --with args' }],
  },
  footer: {
    title: 'Show Help',
    list: [{ label: 'BINARY <command> --help', description: '' }],
  },
};
```

## `examples` Section Convention

`label` is the human-readable comment; `description` is the executable command. They render as:

```
  gli live         # Start live PR dashboard
  gli status       # Snapshot of PR status (exits)
```

## `footer` Section Convention

`label` supports `<placeholder>` tokens — these render in dim cyan. `description` is an optional dim comment.

```ts
{ label: 'gli <command> --help', description: '' }
```

## Consuming in `src/cli.ts`

```ts
import { renderHelp } from 'core/render-help';
// or with verbatimModuleSyntax:
import { renderHelp } from 'core/render-help/index.js';

import { cliHelp } from './cli.help.js';

// In the help command handler or default case:
renderHelp(cliHelp);
```

## Rules

- `src/cli.help.ts` is always at the `src/` root (never in a subfolder).
- Export the config as a named `const cliHelp` (not default export).
- Import type `HelpConfig` from `core/render-help` (not from `types/` or `utils/`).
- Do not call `renderHelp` inside `cli.help.ts` — only declare the config.
- `minWidth` on the root `HelpConfig` object sets the minimum column width for alignment across all sections.
- Per-section `options.labels.minWidth` overrides per-section column width.

## Projects using this pattern

- `@finografic-genx` — `src/cli.help.ts`
- `@finografic-gli` — `src/cli.help.ts`
- Any project scaffolded by genx should receive this file during creation.
