import { resolve } from 'node:path';
import { renderHelp } from 'core/render-help';
import { execa } from 'execa';
import { depsHelp } from 'help/deps.help';
import { errorMessage, infoMessage, intro, logMessage, successMessage, successUpdatedMessage } from 'utils';
import {
  GENX_CONFIG_PATH,
  getPathArg,
  hasManagedFlag,
  isYesMode,
  readManagedTargets,
  resolveTargetDir,
} from 'utils';

import { applyDependencyChanges, planDependencyChanges } from 'lib/migrate/dependencies.utils';
import type { DependencyChange } from 'lib/migrate/dependencies.utils';
import { readPackageJson, writePackageJson } from 'lib/migrate/package-json.utils';
import { promptManagedTargetAction } from 'lib/prompts/managed.prompt';
import { isDevelopment } from 'utils/env.utils';
import { pc } from 'utils/picocolors';
import { validateExistingPackage } from 'utils/validation.utils';
import { dependencyRules } from 'config/dependencies.rules';
import type { ManagedTarget } from 'types/managed.types';

interface OperationColorMap {
  add: typeof pc.green;
  upgrade: typeof pc.cyan;
  downgrade: typeof pc.yellow;
}

const OPERATION_COLOR: OperationColorMap = {
  add: pc.green,
  upgrade: pc.cyan,
  downgrade: pc.yellow,
};

function dependencyChangeLabelInner(operation: DependencyChange['operation']): string {
  if (operation === 'add') return 'add';
  if (operation === 'downgrade') return 'downgrade';
  return 'upgrade';
}

function formatDryRunDependencyLine(change: DependencyChange, labelColumnWidth: number): string {
  const inner = dependencyChangeLabelInner(change.operation);
  const plainLabel = `[${inner}]`;

  const pad = ' '.repeat(Math.max(0, labelColumnWidth - plainLabel.length));

  const color = OPERATION_COLOR[change.operation];
  const labelPart = `${pad}${color(plainLabel)}`;
  const afterLabel = '  ';

  if (change.operation === 'add') {
    return `${labelPart}${afterLabel}${pc.white(`${change.name} ${change.to}`)}`;
  }

  const detail = `${pc.white(change.name)} ${pc.gray(change.from!)} ${pc.white('→')} ${pc.white(change.to)}`;
  return `${labelPart}${afterLabel}${detail}`;
}

export async function syncDeps(argv: string[], context: { cwd: string }): Promise<void> {
  if (argv.includes('--help') || argv.includes('-h')) {
    renderHelp(depsHelp);
    return;
  }

  intro('Sync dependencies to @finografic/deps-policy');

  const debug = isDevelopment() || process.env.FINOGRAFIC_DEBUG === '1';
  if (debug) {
    infoMessage(`execPath: ${process.execPath}`);
    infoMessage(`argv[1]: ${process.argv[1] ?? ''}`);
  }

  const write = argv.includes('--write');
  const managed = hasManagedFlag(argv);
  const yesMode = isYesMode(argv);
  const allowDowngrade = argv.includes('--allow-downgrade');
  const pathArg = getPathArg(argv);

  if (managed && pathArg) {
    errorMessage('Cannot combine [path] with --managed');
    process.exit(1);
    return;
  }

  if (managed) {
    let managedTargets: ManagedTarget[];
    try {
      managedTargets = await readManagedTargets();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to read managed config';
      errorMessage(`${message}\nExpected config: ${pc.cyan(GENX_CONFIG_PATH)}`);
      process.exit(1);
      return;
    }

    if (managedTargets.length === 0) {
      infoMessage(`No managed targets found in ${pc.cyan(GENX_CONFIG_PATH)}`);
      return;
    }

    let appliedCount = 0;
    let skippedCount = 0;

    for (const [index, target] of managedTargets.entries()) {
      if (write && !yesMode) {
        const action = await promptManagedTargetAction({
          actionLabel: 'Sync dependencies for',
          target,
          currentIndex: index + 1,
          total: managedTargets.length,
        });

        if (action === null) {
          process.exit(0);
          return;
        }

        if (action === 'skip') {
          skippedCount += 1;
          continue;
        }
      }

      await syncDepsForTarget(target.path, write, { allowDowngrade });
      appliedCount += 1;
    }

    successMessage(
      `Managed run complete (${appliedCount} processed${skippedCount > 0 ? `, ${skippedCount} skipped` : ''})`,
    );
    return;
  }

  const targetDir = resolveTargetDir(context.cwd, pathArg);
  await syncDepsForTarget(targetDir, write, { allowDowngrade });
}

async function syncDepsForTarget(
  targetDir: string,
  write: boolean,
  options: { allowDowngrade: boolean },
): Promise<void> {
  const validation = validateExistingPackage(targetDir);
  if (!validation.ok) {
    errorMessage(validation.reason || 'Not a valid package directory');
    process.exit(1);
    return;
  }

  const packageJsonPath = resolve(targetDir, 'package.json');
  const packageJson = await readPackageJson(packageJsonPath);

  const changes = planDependencyChanges(packageJson, dependencyRules, {
    allowDowngrade: options.allowDowngrade,
  });

  if (!write) {
    infoMessage(`\nDRY RUN. Planned dependency changes for:\n${pc.cyan(targetDir)}\n`);
    if (changes.length === 0) {
      infoMessage('All dependencies already aligned with policy.');
    } else {
      const maxLabelLen = Math.max(
        ...changes.map((c) => `[${dependencyChangeLabelInner(c.operation)}]`.length),
      );
      // Width of the label column (right-align `[…]`); equals longest label so `|  [downgrade]` keeps exactly clack’s two spaces after the pipe.
      const labelColumnWidth = maxLabelLen;
      for (const change of changes) {
        logMessage(formatDryRunDependencyLine(change, labelColumnWidth));
      }
    }
    infoMessage(
      `\n${pc.greenBright('DRY RUN COMPLETE.')}\n\n${pc.white('Re-run with')} ${pc.greenBright('--write')} ${pc.white('to apply changes.')}\n`,
    );
    return;
  }

  if (changes.length === 0) {
    infoMessage('All dependencies already aligned with policy. No changes made.');
    return;
  }

  const updatedPackageJson = applyDependencyChanges(packageJson, changes);
  await writePackageJson(packageJsonPath, updatedPackageJson);
  successUpdatedMessage(`Updated ${changes.length} ${changes.length === 1 ? 'dependency' : 'dependencies'}`);

  try {
    await execa('pnpm', ['install'], { cwd: targetDir });
    successMessage('Dependencies installed');
  } catch {
    errorMessage('pnpm install failed — run it manually');
  }

  successMessage('Done');
}
