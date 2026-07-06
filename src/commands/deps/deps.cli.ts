import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { withHelp } from '@finografic/cli-kit/render-help';
import type { ColumnDef, MultiselectOption, TableInstance } from '@finografic/cli-kit/tui';
import { createTable, isCancel, multiselectLineBreak } from '@finografic/cli-kit/tui';
import type { DepEntryWithLatest } from '@finografic/deps-policy/display';
import {
  CLACK_MULTISELECT_PREFIX_WIDTH,
  getDepsColumns,
  printDepsRow,
  printDepsTable,
} from '@finografic/deps-policy/display';
import { execa } from 'execa';
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
  warnMessage,
} from 'utils';

import type { GitCommitTracker } from 'lib/git/target-git-commit.utils';
import { commitTrackedGitChanges, createGitCommitTracker } from 'lib/git/target-git-commit.utils';
import { promptManagedTargetAction } from 'lib/managed/managed.prompt';
import type { DependencyChange } from 'lib/migrate/dependencies.utils';
import { applyDependencyChanges, planDependencyChanges } from 'lib/migrate/dependencies.utils';
import { readPackageJson, writePackageJson } from 'lib/migrate/package-json.utils';
import { applyToolchainChanges, planToolchainChanges } from 'lib/migrate/toolchain.utils';
import { isDevelopment } from 'utils/env.utils';
import { pc } from 'utils/picocolors';
import { runPolicyUpdate } from 'utils/policy-update.utils';
import { validateExistingPackage } from 'utils/validation.utils';

import { dependencyRules } from 'config/dependencies.rules';
import { toolchain } from 'config/policy';
import type { DependencyRule } from 'types/dependencies.types';
import type { ManagedTarget } from 'types/managed.types';

import { help } from './deps.help.js';

function parsePrefix(version: string): string {
  return version.match(/^[\^~]/)?.[0] ?? '';
}

function changeToEntry(
  change: DependencyChange,
  rule: DependencyRule | undefined,
  packageJsonPath: string,
): DepEntryWithLatest {
  const prefix = parsePrefix(change.to);
  const bare = change.to.replace(/^[\^~]/, '');
  return {
    name: change.name,
    current: change.from ?? '—',
    prefix,
    bare,
    group: rule?.group ?? 'other',
    sourceFile: packageJsonPath,
    depKind: change.section,
    latest: bare,
    outdated: true,
    pinned: false,
  };
}

function buildSelectOptions(
  entries: DepEntryWithLatest[],
  table: TableInstance<DepEntryWithLatest>,
): Array<MultiselectOption<DepEntryWithLatest>> {
  return entries.map((entry) => ({
    value: entry,
    label: printDepsRow(entry, table.renderRow(entry)),
    initialValue: true,
  }));
}

async function selectEntries(
  entries: DepEntryWithLatest[],
  columns: Array<ColumnDef<DepEntryWithLatest>>,
  message: string,
): Promise<DepEntryWithLatest[]> {
  const msColumns = columns.map((col, i) =>
    i === 0
      ? {
          ...col,
          padding: {
            ...col.padding,
            right: (col.padding?.right ?? 0) - CLACK_MULTISELECT_PREFIX_WIDTH,
          },
        }
      : col,
  );
  const table = createTable<DepEntryWithLatest>(entries, msColumns);
  const options = buildSelectOptions(entries, table);

  const selected = await multiselectLineBreak({ message: `${message}\n`, options, required: false });
  if (isCancel(selected)) {
    process.exit(0);
  }
  return selected;
}

function logWrittenDependencyVersions(changes: DependencyChange[]): void {
  const sorted = [...changes].toSorted((a, b) => a.name.localeCompare(b.name));
  const body = sorted.map((c) => pc.gray(`${pc.green('+')} ${pc.white(c.name)} ${pc.gray(c.to)}`)).join('\n');
  logMessage(body);
}

async function commitDepsChanges(
  tracker: GitCommitTracker | null,
  changedTargetPaths: readonly string[],
): Promise<void> {
  if (changedTargetPaths.length === 0) {
    return;
  }

  try {
    const commitResult = await commitTrackedGitChanges({
      explicitTargetPaths: changedTargetPaths,
      message: 'chore(deps): genx deps synced dependency policy',
      tracker,
    });

    if (commitResult.committed) {
      successMessage(`Committed deps sync: ${commitResult.hash}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnMessage(`Dependencies synced, but Git commit failed: ${message}`);
  }
}

export async function syncDeps(argv: string[], context: { cwd: string }): Promise<void> {
  return withHelp(argv, help, async () => {
    console.log('');
    intro('Sync dependencies to @finografic/deps-policy');

    const debug = isDevelopment() || process.env.FINOGRAFIC_DEBUG === '1';
    if (debug) {
      infoMessage(`execPath: ${process.execPath}`);
      infoMessage(`argv[1]: ${process.argv[1] ?? ''}`);
    }

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
      warnMessage('--managed is deprecated. Use: genx managed deps');
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
        if (!yesMode) {
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

        await syncDepsForTarget(target.path, { allowDowngrade, yesMode });
        appliedCount += 1;
      }

      successMessage(
        `Managed run complete (${appliedCount} processed${skippedCount > 0 ? `, ${skippedCount} skipped` : ''})\n`,
      );
      return;
    }

    const targetDir = resolveTargetDir(context.cwd, pathArg);
    await syncDepsForTarget(targetDir, { allowDowngrade, yesMode });
  });
}

export async function syncDepsForTarget(
  targetDir: string,
  options: { allowDowngrade: boolean; yesMode: boolean },
): Promise<void> {
  const validation = validateExistingPackage(targetDir);
  if (!validation.ok) {
    errorMessage(validation.reason || 'Not a valid package directory');
    process.exit(1);
  }

  const packageJsonPath = resolve(targetDir, 'package.json');
  const packageJson = await readPackageJson(packageJsonPath);
  const commitTracker = await createGitCommitTracker(targetDir);
  const changedTargetPaths = new Set<string>();

  const allChanges = planDependencyChanges(packageJson, dependencyRules, {
    allowDowngrade: options.allowDowngrade,
    includeMissing: false,
  });

  const header = pc.cyan(targetDir.replace(homedir(), ''));
  infoMessage(`\n${header}`);

  const toolchainChanges = await planToolchainChanges(targetDir, packageJson, toolchain);

  if (allChanges.length === 0 && toolchainChanges.length === 0) {
    infoMessage(pc.white('All dependencies and toolchain versions already aligned with policy.'));
    return;
  }

  const ruleByName = new Map(dependencyRules.map((r) => [r.name, r]));
  const updateChanges = allChanges.filter((c) => c.operation !== 'add');

  const columns = getDepsColumns();

  // ─── Show upgrade/downgrade table ──────────────────────────────
  if (updateChanges.length > 0) {
    const updateEntries = updateChanges.map((c) => changeToEntry(c, ruleByName.get(c.name), packageJsonPath));
    printDepsTable(updateEntries, columns);
    console.log();
  }

  // ─── Select packages (interactive) or apply all (--yes / -y) ─────────
  const selectedChanges: DependencyChange[] = [];

  if (options.yesMode) {
    selectedChanges.push(...updateChanges);
  } else {
    if (updateChanges.length > 0) {
      const updateEntries = updateChanges.map((c) =>
        changeToEntry(c, ruleByName.get(c.name), packageJsonPath),
      );
      const selectedEntries = await selectEntries(updateEntries, columns, 'Select packages to update');
      const selectedNames = new Set(selectedEntries.map((e) => e.name));
      selectedChanges.push(...updateChanges.filter((c) => selectedNames.has(c.name)));
    }
  }

  if (selectedChanges.length === 0 && toolchainChanges.length === 0) {
    infoMessage(pc.white('No changes selected.'));
    return;
  }

  let updatedPackageJson = applyDependencyChanges(packageJson, selectedChanges);

  if (selectedChanges.length > 0) {
    await writePackageJson(packageJsonPath, updatedPackageJson);
    changedTargetPaths.add(packageJsonPath);

    const installSpin = spinner();
    const updatingLabel =
      selectedChanges.length === 1
        ? 'Updating 1 dependency'
        : `Updating ${selectedChanges.length} dependencies`;
    installSpin.start(pc.cyan(updatingLabel));

    try {
      await execa('pnpm', ['install'], { cwd: targetDir });
      installSpin.stop(pc.green('Dependencies installed'));
      changedTargetPaths.add(resolve(targetDir, 'pnpm-lock.yaml'));
      logWrittenDependencyVersions(selectedChanges);
    } catch {
      installSpin.stop('Failed to install dependencies');
      errorMessage('pnpm install failed — run it manually');
    }
  }

  if (toolchainChanges.length > 0) {
    const labels = toolchainChanges.map((c) => {
      const from = c.from ? ` ${pc.gray(`from ${c.from}`)}` : '';
      return `  ${pc.green('+')} ${pc.white(c.target)} ${pc.cyan(c.to)}${from}`;
    });
    logMessage(`${pc.cyan('Toolchain versions:')}\n${labels.join('\n')}`);

    updatedPackageJson = await applyToolchainChanges(targetDir, updatedPackageJson, toolchainChanges);
    await writePackageJson(packageJsonPath, updatedPackageJson);
    changedTargetPaths.add(packageJsonPath);
    if (toolchainChanges.some((change) => change.target === '.nvmrc')) {
      changedTargetPaths.add(resolve(targetDir, '.nvmrc'));
    }
    successMessage('Toolchain versions updated');
  }

  await commitDepsChanges(commitTracker, [...changedTargetPaths]);
  successMessage('Done\n');
}
