import { GENX_CONFIG_PATH, errorMessage, infoMessage, intro, readManagedTargets } from 'utils';

import { CommitDraftCache } from 'lib/ai/commit-draft';
import { readTargetGitStatus } from 'lib/git/target-git-status.utils';
import type { StyledMultiSelectRowState } from 'lib/prompts/styled-multiselect.prompt';
import { promptStyledMultiSelect } from 'lib/prompts/styled-multiselect.prompt';
import { pc } from 'utils/picocolors';
import { cancel, spinner } from 'utils/prompts.utils';

import type { ManagedTarget } from 'types/managed.types';

import { runCommitPhase } from './managed.status.commit.js';

interface ManagedStatusResult {
  branch: string | null;
  dirtyCount: number;
  isRepo: boolean;
  target: ManagedTarget;
}

function isDirty(result: ManagedStatusResult): boolean {
  return result.isRepo && result.dirtyCount > 0;
}

/** Row text split into a name part and a status-suffix part, so each can be tinted separately. */
function labelParts(result: ManagedStatusResult): { name: string; suffix: string } {
  const branch = result.branch ? ` [${result.branch}]` : '';
  const name = `${result.target.name}${branch}`;

  if (!result.isRepo) return { name: result.target.name, suffix: '(not a git repo)' };
  if (result.dirtyCount === 0) return { name, suffix: '(clean)' };

  const files = result.dirtyCount === 1 ? 'file' : 'files';
  return { name, suffix: `(${result.dirtyCount} uncommitted ${files})` };
}

/** Plain, uncolored row text — the fallback used for width calculations. */
function optionLabel(result: ManagedStatusResult): string {
  const { name, suffix } = labelParts(result);
  return `${name} ${suffix}`;
}

async function readStatusTargets(): Promise<ManagedTarget[]> {
  try {
    return await readManagedTargets();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to read managed config';
    errorMessage(`${message}\nExpected config: ${pc.cyan(GENX_CONFIG_PATH)}`);
    process.exit(1);
  }
}

async function collectStatuses(managedTargets: ManagedTarget[]): Promise<ManagedStatusResult[]> {
  const progress = spinner();
  progress.start('Reading git status for managed targets');

  const results = await Promise.all(
    managedTargets.map(async (target) => {
      const status = await readTargetGitStatus(target.path);
      return {
        branch: status.branch,
        dirtyCount: status.dirtyCount,
        isRepo: status.isRepo,
        target,
      } satisfies ManagedStatusResult;
    }),
  );

  progress.stop('Git status collected');
  return results;
}

/** One-line tally only — the per-target detail is carried by the selection prompt itself. */
function printSummary(results: ManagedStatusResult[]): void {
  const dirtyCount = results.filter(isDirty).length;
  const cleanCount = results.length - dirtyCount;

  infoMessage(
    `Managed status: ${dirtyCount} target(s) with uncommitted changes${cleanCount > 0 ? `, ${cleanCount} clean` : ''}`,
  );
}

export async function runManagedStatusFlow(_argv: string[]): Promise<void> {
  intro('Managed git status across @finografic packages');

  const managedTargets = await readStatusTargets();

  if (managedTargets.length === 0) {
    infoMessage(`No managed targets found in ${pc.cyan(GENX_CONFIG_PATH)}`);
    return;
  }

  const results = await collectStatuses(managedTargets);
  printSummary(results);

  const dirtyResults = results.filter(isDirty);
  if (dirtyResults.length === 0) {
    infoMessage('All managed worktrees are clean — nothing to resolve.');
    return;
  }

  // Draft the first target's message now, so it is ready by the time the user finishes
  // choosing. It is the first pre-checked row; wasted only if they deselect it.
  const drafts = new CommitDraftCache();
  drafts.preload(dirtyResults[0]?.target.path);

  // Clean targets are omitted entirely — the summary above already accounts for them.
  const options = dirtyResults.map((result) => {
    const { name, suffix } = labelParts(result);
    return {
      value: result.target.path,
      label: optionLabel(result),
      // Live rows lead with the yellow count; once confirmed the list is a settled
      // record rather than a call to action, so it recedes to white-on-grey.
      style: ({ focused, submitted }: StyledMultiSelectRowState) =>
        submitted
          ? `${pc.white(name)} ${pc.gray(suffix)}`
          : `${focused ? pc.white(name) : pc.gray(name)} ${pc.yellow(suffix)}`,
    };
  });

  const selectedPaths = await promptStyledMultiSelect({
    message: 'Targets to resolve (all pre-selected):',
    options,
    initialValues: dirtyResults.map((result) => result.target.path),
  });

  if (selectedPaths === null) {
    cancel();
    return;
  }

  if (selectedPaths.length === 0) {
    infoMessage('No targets selected.');
    return;
  }

  const selected = new Set(selectedPaths);
  const selectedTargets = dirtyResults
    .filter((result) => selected.has(result.target.path))
    .map((result) => result.target);

  await runCommitPhase(selectedTargets, drafts);
}
