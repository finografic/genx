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
  runPnpmInstall,
  spinner,
  successMessage,
  warnMessage,
} from 'utils';

import type { GitCommitTracker } from 'lib/git/target-git-commit.utils';
import { commitTrackedGitChanges, createGitCommitTracker } from 'lib/git/target-git-commit.utils';
import { promptManagedTargetAction } from 'lib/managed/managed.prompt';
import { collectWorkspaceManifests } from 'lib/monorepo/monorepo.workspace';
import type { DependencyChange } from 'lib/package-policy/dependencies.utils';
import { applyDependencyChanges, planDependencyChanges } from 'lib/package-policy/dependencies.utils';
import { readPackageJson, writePackageJson } from 'lib/package-policy/package-json.utils';
import type { ToolchainChange } from 'lib/package-policy/toolchain.utils';
import { applyToolchainChanges, planToolchainChanges } from 'lib/package-policy/toolchain.utils';
import { isDevelopment } from 'utils/env.utils';
import { pc } from 'utils/picocolors';
import { runPolicyUpdate } from 'utils/policy-update.utils';
import { validateExistingPackage } from 'utils/validation.utils';

import { dependencyRules } from 'config/dependencies.rules';
import { toolchain } from 'config/policy';
import type { DependencyRule } from 'types/dependencies.types';
import type { ManagedTarget } from 'types/managed.types';
import type { PackageJson } from 'types/package-json.types';

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

/** Spinner label for the single install, which may cover dependencies, the toolchain, or both. */
function describeInstallStep(dependencyCount: number, toolchainCount: number): string {
  if (dependencyCount === 0) return 'Installing with updated toolchain';

  const dependencies = dependencyCount === 1 ? '1 dependency' : `${dependencyCount} dependencies`;
  return toolchainCount > 0 ? `Updating ${dependencies} and toolchain` : `Updating ${dependencies}`;
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

    if (updatePolicy && pathArg) {
      errorMessage('--update-policy cannot be combined with a path argument');
      process.exit(1);
    }

    if (updatePolicy && !managed) {
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
      if (updatePolicy) {
        const found = await runPolicyUpdate(true);
        if (!found) {
          errorMessage(
            `depsPolicyPath not set in config.\nAdd it to ${pc.cyan(GENX_CONFIG_PATH)} to use --update-policy.`,
          );
          process.exit(1);
          return;
        }
      }
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
      let alignedCount = 0;

      for (const [index, target] of managedTargets.entries()) {
        // Check before asking. Prompting about a repo that turns out to need nothing is how a
        // long managed run teaches you to press Enter without reading it.
        if (!(await targetHasPendingChanges(target.path, { allowDowngrade }))) {
          infoMessage(`\n${pc.cyan(target.path.replace(homedir(), ''))}`);
          infoMessage(pc.white('All dependencies and toolchain versions already aligned with policy.'));
          alignedCount += 1;
          continue;
        }

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

      const summary = [
        `${appliedCount} processed`,
        ...(alignedCount > 0 ? [`${alignedCount} already aligned`] : []),
        ...(skippedCount > 0 ? [`${skippedCount} skipped`] : []),
      ].join(', ');
      successMessage(`Managed run complete (${summary})\n`);
      return;
    }

    const targetDir = resolveTargetDir(context.cwd, pathArg);
    await syncDepsForTarget(targetDir, { allowDowngrade, yesMode });
  });
}
interface ManifestPlan {
  packageJsonPath: string;
  /** Path relative to the workspace root; empty for the root manifest itself. */
  label: string;
  packageJson: PackageJson;
  changes: DependencyChange[];
}

interface TargetPlan {
  rootPackageJsonPath: string;
  rootPackageJson: PackageJson;
  plans: ManifestPlan[];
  toolchainChanges: ToolchainChange[];
}

/**
 * Work out everything a target needs without writing anything or prompting.
 *
 * Split out from the apply step so a managed run can tell whether a repo needs attention
 * *before* asking about it — presenting Apply/Skip/Cancel for a repo that turns out to be
 * already aligned trains you to hit Enter without reading.
 */
async function planTarget(targetDir: string, options: { allowDowngrade: boolean }): Promise<TargetPlan> {
  const rootPackageJsonPath = resolve(targetDir, 'package.json');
  const rootPackageJson = await readPackageJson(rootPackageJsonPath);

  const manifestPaths = await collectWorkspaceManifests(targetDir, rootPackageJson);

  const plans: ManifestPlan[] = [];
  for (const { packageJsonPath, label } of manifestPaths) {
    const packageJson =
      packageJsonPath === rootPackageJsonPath ? rootPackageJson : await readPackageJson(packageJsonPath);

    plans.push({
      packageJsonPath,
      label,
      packageJson,
      // `add` operations are dropped here as they always were: this command aligns what a package
      // already declares and never introduces a dependency it did not ask for.
      changes: planDependencyChanges(packageJson, dependencyRules, {
        allowDowngrade: options.allowDowngrade,
        includeMissing: false,
      }).filter((change) => change.operation !== 'add'),
    });
  }

  // Toolchain is a root concern — `.nvmrc` and `packageManager` govern the whole workspace.
  const toolchainChanges = await planToolchainChanges(targetDir, rootPackageJson, toolchain);

  return { rootPackageJsonPath, rootPackageJson, plans, toolchainChanges };
}

function planIsEmpty(plan: TargetPlan): boolean {
  return plan.plans.every((manifest) => manifest.changes.length === 0) && plan.toolchainChanges.length === 0;
}

/** True when a target has anything to align. Reads only — never writes or prompts. */
export async function targetHasPendingChanges(
  targetDir: string,
  options: { allowDowngrade: boolean },
): Promise<boolean> {
  const validation = validateExistingPackage(targetDir);
  if (!validation.ok) return false;

  return !planIsEmpty(await planTarget(targetDir, options));
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

  const commitTracker = await createGitCommitTracker(targetDir);
  const changedTargetPaths = new Set<string>();

  const targetPlan = await planTarget(targetDir, { allowDowngrade: options.allowDowngrade });
  const { rootPackageJsonPath, rootPackageJson, plans, toolchainChanges } = targetPlan;

  const header = pc.cyan(targetDir.replace(homedir(), ''));
  infoMessage(`\n${header}`);

  if (planIsEmpty(targetPlan)) {
    infoMessage(pc.white('All dependencies and toolchain versions already aligned with policy.'));
    return;
  }

  const ruleByName = new Map(dependencyRules.map((r) => [r.name, r]));
  const columns = getDepsColumns();

  const appliedChanges: DependencyChange[] = [];
  let rootPackageJsonAfterDeps = rootPackageJson;

  for (const plan of plans) {
    if (plan.changes.length === 0) continue;

    if (plan.label) infoMessage(pc.gray(plan.label));

    const entries = plan.changes.map((change) =>
      changeToEntry(change, ruleByName.get(change.name), plan.packageJsonPath),
    );
    printDepsTable(entries, columns);
    console.log();

    let selectedChanges = plan.changes;

    if (!options.yesMode) {
      const prompt = plan.label ? `Select packages to update — ${plan.label}` : 'Select packages to update';
      const selectedEntries = await selectEntries(entries, columns, prompt);
      const selectedNames = new Set(selectedEntries.map((entry) => entry.name));
      selectedChanges = plan.changes.filter((change) => selectedNames.has(change.name));
    }

    if (selectedChanges.length === 0) continue;

    const updatedPackageJson = applyDependencyChanges(plan.packageJson, selectedChanges);
    await writePackageJson(plan.packageJsonPath, updatedPackageJson);
    changedTargetPaths.add(plan.packageJsonPath);
    appliedChanges.push(...selectedChanges);

    if (plan.packageJsonPath === rootPackageJsonPath) {
      rootPackageJsonAfterDeps = updatedPackageJson;
    }
  }

  if (appliedChanges.length === 0 && toolchainChanges.length === 0) {
    infoMessage(pc.white('No changes selected.'));
    return;
  }

  if (toolchainChanges.length > 0) {
    const labels = toolchainChanges.map((c) => {
      const from = c.from ? ` ${pc.gray(`from ${c.from}`)}` : '';
      return `  ${pc.green('+')} ${pc.white(c.target)} ${pc.cyan(c.to)}${from}`;
    });
    logMessage(`${pc.cyan('Toolchain versions:')}\n${labels.join('\n')}`);

    const withToolchain = await applyToolchainChanges(targetDir, rootPackageJsonAfterDeps, toolchainChanges);
    await writePackageJson(rootPackageJsonPath, withToolchain);
    changedTargetPaths.add(rootPackageJsonPath);

    if (toolchainChanges.some((change) => change.target === '.nvmrc')) {
      changedTargetPaths.add(resolve(targetDir, '.nvmrc'));
    }
    successMessage('Toolchain versions updated');
  }

  // Install last, after every write. A `packageManager` bump must be on disk before pnpm runs, or
  // the install executes under the version being replaced — and a toolchain-only run would
  // otherwise never install at all, leaving a version that has never been exercised locally.
  // One install at the root is enough: pnpm resolves every workspace member in a single pass.
  const installSpin = spinner();
  installSpin.start(pc.cyan(describeInstallStep(appliedChanges.length, toolchainChanges.length)));

  try {
    await runPnpmInstall(targetDir);
    installSpin.stop(pc.green('Dependencies installed'));
    changedTargetPaths.add(resolve(targetDir, 'pnpm-lock.yaml'));
    if (appliedChanges.length > 0) {
      logWrittenDependencyVersions(appliedChanges);
    }
  } catch (error) {
    installSpin.stop('Failed to install dependencies');
    const message = error instanceof Error ? error.message : String(error);
    errorMessage(`pnpm install failed — ${message}`);
    return;
  }

  await commitDepsChanges(commitTracker, [...changedTargetPaths]);
  successMessage('Done\n');
}
