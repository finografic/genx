import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { renderHelp } from '@finografic/cli-kit/render-help';
import { execa } from 'execa';
import { depsHelp } from 'help/deps.help';
import {
  GENX_CONFIG_PATH,
  errorMessage,
  getPathArg,
  hasManagedFlag,
  infoMessage,
  intro,
  isYesMode,
  logMessage,
  readManagedTargets,
  resolveTargetDir,
  spinner,
  successMessage,
} from 'utils';

import { applyDependencyChanges, planDependencyChanges } from 'lib/migrate/dependencies.utils';
import type { DependencyChange } from 'lib/migrate/dependencies.utils';
import { readPackageJson, writePackageJson } from 'lib/migrate/package-json.utils';
import { promptManagedTargetAction } from 'lib/prompts/managed.prompt';
import { isDevelopment } from 'utils/env.utils';
import { pc } from 'utils/picocolors';
import { runPolicyUpdate } from 'utils/policy-update.utils';
import { validateExistingPackage } from 'utils/validation.utils';

import { dependencyRules } from 'config/dependencies.rules';
import type { ManagedTarget } from 'types/managed.types';

const SEPARATOR = '—'.repeat(50);

const OPERATION_COLOR = {
  add: pc.green,
  upgrade: pc.cyan,
  downgrade: pc.yellow,
} satisfies Record<DependencyChange['operation'], (s: string) => string>;

const formatVersionChange = (c: DependencyChange): string => `${c.name} ${pc.gray(c.from!)} → ${c.to}`;

const FORMATTERS = {
  add: (c: DependencyChange): string => `${c.name} ${c.to}`,
  upgrade: formatVersionChange,
  downgrade: formatVersionChange,
} satisfies Record<DependencyChange['operation'], (c: DependencyChange) => string>;

function padLeft(value: string, width: number): string {
  return ' '.repeat(Math.max(0, width - value.length)) + value;
}

function renderDependencyChangeLine(change: DependencyChange, labelColumnWidth: number): string {
  const label = `[${change.operation}]`;

  return (
    OPERATION_COLOR[change.operation](padLeft(label, labelColumnWidth)) +
    '  ' +
    pc.white(FORMATTERS[change.operation](change))
  );
}

function logWrittenDependencyVersions(changes: DependencyChange[]): void {
  const sorted = [...changes].sort((a, b) => a.name.localeCompare(b.name));
  const body = sorted.map((c) => pc.gray(`${pc.green('+')} ${pc.white(c.name)} ${pc.gray(c.to)}`)).join('\n');
  logMessage(body);
}

export async function syncDeps(argv: string[], context: { cwd: string }): Promise<void> {
  if (argv.includes('--help') || argv.includes('-h')) {
    renderHelp(depsHelp);
    return;
  }

  console.log('');
  intro('Sync dependencies to @finografic/deps-policy');

  const debug = isDevelopment() || process.env.FINOGRAFIC_DEBUG === '1';
  if (debug) {
    infoMessage(`execPath: ${process.execPath}`);
    infoMessage(`argv[1]: ${process.argv[1] ?? ''}`);
  }

  const write = argv.includes('--write');
  const managed = hasManagedFlag(argv);
  const updatePolicy = argv.includes('--update-policy');
  const yesMode = isYesMode(argv);
  const allowDowngrade = argv.includes('--allow-downgrade');
  const pathArg = getPathArg(argv);

  if (updatePolicy && (managed || pathArg)) {
    errorMessage('--update-policy cannot be combined with --managed or a path argument');
    process.exit(1);
  }

  if (updatePolicy) {
    const found = await runPolicyUpdate(false);
    if (!found) {
      errorMessage(
        `depsPolicyPath not set in config.\nAdd it to ${pc.cyan(GENX_CONFIG_PATH)} to use --update-policy.`,
      );
      process.exit(1);
    }
    return;
  }

  if (managed && pathArg) {
    errorMessage('Cannot combine [path] with --managed');
    process.exit(1);
  }

  if (managed) {
    // Silently update deps-policy first so the freshest versions are used for all targets.
    await runPolicyUpdate(true);
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
      `Managed run complete (${appliedCount} processed${skippedCount > 0 ? `, ${skippedCount} skipped` : ''})\n`,
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
  }

  const packageJsonPath = resolve(targetDir, 'package.json');
  const packageJson = await readPackageJson(packageJsonPath);

  const changes = planDependencyChanges(packageJson, dependencyRules, {
    allowDowngrade: options.allowDowngrade,
  });

  if (!write) {
    infoMessage(
      `${pc.gray(pc.dim(SEPARATOR))}\n\n${pc.cyan(targetDir.replace(homedir(), ''))} ${pc.white(pc.dim('(DRY RUN)'))}`,
    );
    if (changes.length === 0) {
      infoMessage(pc.white('All dependencies already aligned with policy.'));
    } else {
      const maxLabelLen = Math.max(...changes.map((c) => `[${c.operation}]`.length));
      const labelColumnWidth = maxLabelLen;
      for (const change of changes) {
        logMessage(renderDependencyChangeLine(change, labelColumnWidth));
      }
    }
    infoMessage(
      `${pc.white(pc.dim('Re-run with'))} ${pc.yellow('--write')} ${pc.white(pc.dim('to apply changes.'))}`,
    );
    return;
  }

  if (changes.length === 0) {
    infoMessage(pc.white('All dependencies already aligned with policy. No changes made.'));
    return;
  }

  const updatedPackageJson = applyDependencyChanges(packageJson, changes);
  await writePackageJson(packageJsonPath, updatedPackageJson);

  const installSpin = spinner();
  const updatingLabel =
    changes.length === 1 ? 'Updating 1 dependency' : `Updating ${changes.length} dependencies`;
  installSpin.start(pc.cyan(updatingLabel));

  try {
    await execa('pnpm', ['install'], { cwd: targetDir });
    installSpin.stop(pc.green('Dependencies installed'));
    logWrittenDependencyVersions(changes);
    successMessage('Done\n');
  } catch {
    installSpin.stop('Failed to install dependencies');
    errorMessage('pnpm install failed — run it manually');
  }
}
