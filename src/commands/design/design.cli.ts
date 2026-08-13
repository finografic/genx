import { withHelp } from '@finografic/cli-kit/render-help';
import {
  errorMessage,
  infoMessage,
  intro,
  outro,
  resolveTargetDir,
  successMessage,
  warnMessage,
} from 'utils';

import { runCheck } from './lib/check.runner.js';
import { parseDesignArgs } from './lib/design-args.utils.js';
import { runLint } from './lib/lint.runner.js';
import { runPull } from './lib/pull.runner.js';
import { runPush } from './lib/push.runner.js';
import { runRender } from './lib/render.runner.js';

import { help } from './design.help.js';

const SUBCOMMANDS = new Set(['sync', 'check', 'render', 'lint']);

export async function runDesign(argv: string[], context: { cwd: string }): Promise<void> {
  return withHelp(argv, help, async () => {
    const subcommand = argv[0];
    if (!subcommand || !SUBCOMMANDS.has(subcommand)) {
      errorMessage(
        `Unknown design subcommand: ${subcommand ?? '(none)'}. Expected sync | check | render | lint.`,
      );
      process.exitCode = 1;
      return;
    }

    const args = parseDesignArgs(argv.slice(1));
    const targetDir = resolveTargetDir(context.cwd, args.positionals[0]);

    switch (subcommand) {
      case 'sync': {
        if (args.pull === args.push) {
          errorMessage(
            'sync requires exactly one direction: --pull (design system → DESIGN.md) or --push (DESIGN.md → design system).',
          );
          process.exitCode = 1;
          return;
        }
        intro(args.pull ? 'Sync DESIGN.md from design system' : 'Push DESIGN.md tokens into design system');
        const pullResult = args.pull
          ? await runPull(targetDir, { yes: args.yes, framework: args.framework, file: args.file })
          : undefined;
        const result =
          pullResult ?? (await runPush(targetDir, { framework: args.framework, file: args.file }));
        for (const warning of pullResult?.warnings ?? []) {
          warnMessage(warning);
        }
        if (result.status === 'error') {
          errorMessage(result.message);
          process.exitCode = 1;
          return;
        }
        if (result.status === 'skipped') {
          warnMessage(result.message);
        } else if (result.status === 'up-to-date') {
          infoMessage(result.message);
        } else {
          successMessage(result.message);
        }
        outro('Sync complete');
        return;
      }

      case 'check': {
        const result = await runCheck(targetDir, { framework: args.framework, file: args.file });
        if (args.format === 'json') {
          console.log(
            JSON.stringify({ drift: result.exitCode !== 0, report: result.report ?? null }, null, 2),
          );
        } else {
          for (const line of result.lines) {
            console.log(line);
          }
          if (result.exitCode === 0) {
            successMessage(result.message);
          } else {
            errorMessage(result.message);
          }
        }
        process.exitCode = result.exitCode;
        return;
      }

      case 'lint': {
        const result = runLint(targetDir, { file: args.file });
        if (args.format === 'json') {
          console.log(JSON.stringify(result.json, null, 2));
        } else {
          for (const line of result.lines) {
            console.log(line);
          }
          if (result.exitCode === 0) {
            successMessage(result.message);
          } else {
            errorMessage(result.message);
          }
        }
        process.exitCode = result.exitCode;
        return;
      }

      case 'render': {
        const result = runRender(targetDir, { file: args.file, out: args.out });
        if (result.exitCode === 0) {
          successMessage(result.message);
        } else {
          errorMessage(result.message);
        }
        process.exitCode = result.exitCode;
        return;
      }

      default:
    }
  });
}
