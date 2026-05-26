# README Docs Generator

Generates the command documentation sections in `README.md` from the CLI help configs.

## How it works

Each genx command has a `*.help.ts` file that defines a `CommandHelpConfig` object (from `@finografic/cli-kit/render-help`). This script reads those configs and converts them to markdown, then stitches the output into `README.md` between marker comments.

The help config is the **single source of truth** — the same data powers both `genx <command> --help` in the terminal and the README command docs.

## Running

```bash
pnpm docs:usage
```

This is also run automatically by the `post-commit` hook.

## What gets generated

The script fills three marker-delimited sections in `README.md`:

| Marker                                      | Content                                                   |
| ------------------------------------------- | --------------------------------------------------------- |
| `<!-- GENERATED:USAGE:START/END -->`        | Per-command docs (usage, options, examples, how it works) |
| `<!-- GENERATED:FEATURES:START/END -->`     | Feature summaries from `src/features/*/README.md`         |
| `<!-- GENERATED:COMMANDS_REF:START/END -->` | Commands reference table with options                     |

## Adding a new command

1. Create `src/commands/<name>/<name>.help.ts` exporting a `CommandHelpConfig`:

```ts
import type { CommandHelpConfig } from '@finografic/cli-kit/render-help';

export const help: CommandHelpConfig = {
  command: 'genx <name>',
  description: 'What this command does',
  usage: 'genx <name> [path] [options]',
  options: [
    { flag: '-y, --yes', description: 'Skip confirmation prompts' },
  ],
  examples: [
    { command: 'genx <name>', description: 'Run interactively' },
  ],
  howItWorks: [
    'Step one',
    'Step two',
  ],
};
```

2. Wire the help into the command with `withHelp`:

```ts
import { withHelp } from '@finografic/cli-kit/render-help';
import { help } from './<name>.help.js';

export async function run(argv: string[]): Promise<void> {
  return withHelp(argv, help, async () => {
    // command body
  });
}
```

3. Add the import to `scripts/generate-readme-usage.ts` in the `COMMAND_CONFIGS` array.

4. Run `pnpm docs:usage` to regenerate.

## Field-to-markdown mapping

| `CommandHelpConfig` field | Markdown output           |
| ------------------------- | ------------------------- |
| `command`                 | `### heading`             |
| `description`             | Paragraph                 |
| `usage`                   | Fenced code block         |
| `subcommands`             | Table (Subcommand / Desc) |
| `options`                 | Table (Flag / Desc)       |
| `examples`                | Fenced code block         |
| `howItWorks`              | Numbered list             |
| `sections`                | Bold heading + content    |
