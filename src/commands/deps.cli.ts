import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { renderHelp } from '@finografic/cli-kit/render-help';
import { createTable, isCancel, multiselectLineBreak } from '@finografic/cli-kit/tui';
import type { ColumnDef, MultiselectOption, TableInstance } from '@finografic/cli-kit/tui';
import {
  CLACK_MULTISELECT_PREFIX_WIDTH,
  getDepsColumns,
  printDepsRow,
  printDepsTable,
} from '@finografic/deps-policy/display';
import type { DepEntryWithLatest } from '@finografic/deps-policy/display';
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

import type { DependencyChange } from 'lib/migrate/dependencies.utils';
import { applyDependencyChanges, planDependencyChanges } from 'lib/migrate/dependencies.utils';
import { readPackageJson, writePackageJson } from 'lib/migrate/package-json.utils';
import { promptManagedTargetAction } from 'lib/prompts/managed.prompt';
import { isDevelopment } from 'utils/env.utils';
import { pc } from 'utils/picocolors';
import { runPolicyUpdate } from 'utils/policy-update.utils';
import { validateExistingPackage } from 'utils/validation.utils';

import { dependencyRules } from 'config/dependencies.rules';
import type { DependencyRule } from 'types/dependencies.types';
import type { ManagedTarget } from 'types/managed.types';

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

  const allChanges = planDependencyChanges(packageJson, dependencyRules, {
    allowDowngrade: options.allowDowngrade,
  });

  const header = `${pc.cyan(targetDir.replace(homedir(), ''))}${write ? '' : pc.white(pc.dim(' (DRY RUN)'))}`;
  infoMessage(`\n${header}`);

  if (allChanges.length === 0) {
    infoMessage(pc.white('All dependencies already aligned with policy.'));
    return;
  }

  const ruleByName = new Map(dependencyRules.map((r) => [r.name, r]));
  const updateChanges = allChanges.filter((c) => c.operation !== 'add');
  const addChanges = allChanges.filter((c) => c.operation === 'add');

  const columns = getDepsColumns();

  // ─── Show upgrade/downgrade table ──────────────────────────────
  if (updateChanges.length > 0) {
    const updateEntries = updateChanges.map((c) => changeToEntry(c, ruleByName.get(c.name), packageJsonPath));
    printDepsTable(updateEntries, columns);
    console.log();
  }

  // ─── Show add table ─────────────────────────────────────────────
  if (addChanges.length > 0) {
    const addEntries = addChanges.map((c) => changeToEntry(c, ruleByName.get(c.name), packageJsonPath));
    printDepsTable(addEntries, columns);
    console.log();
  }

  if (!write) {
    infoMessage(
      `${pc.white(pc.dim('Re-run with'))} ${pc.yellow('--write')} ${pc.white(pc.dim('to apply changes.'))}`,
    );
    return;
  }

  // ─── Interactive selection ───────────────────────────────────────
  const selectedChanges: DependencyChange[] = [];

  if (updateChanges.length > 0) {
    const updateEntries = updateChanges.map((c) => changeToEntry(c, ruleByName.get(c.name), packageJsonPath));
    const selectedEntries = await selectEntries(updateEntries, columns, 'Select packages to update');
    const selectedNames = new Set(selectedEntries.map((e) => e.name));
    selectedChanges.push(...updateChanges.filter((c) => selectedNames.has(c.name)));
  }

  if (addChanges.length > 0) {
    const addEntries = addChanges.map((c) => changeToEntry(c, ruleByName.get(c.name), packageJsonPath));
    const selectedEntries = await selectEntries(addEntries, columns, 'Select packages to add');
    const selectedNames = new Set(selectedEntries.map((e) => e.name));
    selectedChanges.push(...addChanges.filter((c) => selectedNames.has(c.name)));
  }

  if (selectedChanges.length === 0) {
    infoMessage(pc.white('No changes selected.'));
    return;
  }

  const updatedPackageJson = applyDependencyChanges(packageJson, selectedChanges);
  await writePackageJson(packageJsonPath, updatedPackageJson);

  const installSpin = spinner();
  const updatingLabel =
    selectedChanges.length === 1
      ? 'Updating 1 dependency'
      : `Updating ${selectedChanges.length} dependencies`;
  installSpin.start(pc.cyan(updatingLabel));

  try {
    await execa('pnpm', ['install'], { cwd: targetDir });
    installSpin.stop(pc.green('Dependencies installed'));
    logWrittenDependencyVersions(selectedChanges);
    successMessage('Done\n');
  } catch {
    installSpin.stop('Failed to install dependencies');
    errorMessage('pnpm install failed — run it manually');
  }
}
