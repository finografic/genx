import { promptConfirm } from '@finografic/cli-kit/flow';
import type { FlowContext } from '@finografic/cli-kit/flow';
import { infoMessage, spinner, successMessage, warnMessage } from 'utils';

import { commitAllChanges } from 'lib/git/target-git-commit.utils';

import { buildSkillsAddArgs, buildSkillsRestoreArgs, runSkillsCli } from './skills-cli.runner.js';
import { resolveSkillsStatus } from './skills-lock.utils.js';
import { SHARED_SKILLS_SOURCE, SKILLS_LOCKFILE } from './skills.constants.js';

const ADD_COMMIT_MESSAGE = `chore(skills): install shared skills from ${SHARED_SKILLS_SOURCE}`;
const RESTORE_COMMIT_MESSAGE = `chore(skills): restore skills from ${SKILLS_LOCKFILE}`;

/**
 * Committed on its own, ahead of the symlinks, so neither half of the type change is unstashable.
 * `--no-verify` would have been the shorter route and the wrong one: it disables lint and format on
 * a commit that rewrites agent configuration.
 */
const REMOVE_COMMIT_MESSAGE = 'chore(skills): remove vendored skill copies';

export interface InstallSharedSkillsOptions {
  targetDir: string;
  /** Prompt before installing. Omit to install without asking — see {@link installSharedSkills}. */
  flow?: FlowContext;
  /** Commit the result. `create` runs before `git init`, so it passes `false`. */
  commit: boolean;
}

export interface InstallSharedSkillsResult {
  /** Whether the CLI ran at all. */
  ran: boolean;
  /** Present when the CLI ran and failed. Never thrown — failure here is non-fatal. */
  error?: string;
}

/**
 * Bring this repository's shared skills under the Agent Skills CLI.
 *
 * Genx invokes the CLI rather than only reporting, because `skills add` clones from GitHub and
 * needs no local checkout — unlike the vendoring it replaces, which requires
 * `@finografic/ai-agent-config` resolved locally and so fails on a fresh machine.
 *
 * Passing `flow` makes it an offer, which is what `upgrade` wants: installing rewrites
 * `.claude/skills/` in a repository the user did not ask to migrate. `create` omits it — a brand
 * new project has nothing to overwrite, and skills are baseline there the way `oxc-config` is.
 */
export async function installSharedSkills(
  options: InstallSharedSkillsOptions,
): Promise<InstallSharedSkillsResult> {
  const status = await resolveSkillsStatus(options.targetDir);

  if (status.state === 'managed') {
    infoMessage(
      `${status.locked.length} skill(s) managed by ${SKILLS_LOCKFILE} — run \`npx skills update\` to pull upstream changes`,
    );
    return { ran: false };
  }

  const restoring = status.state === 'incomplete';

  if (options.flow) {
    const message = restoring
      ? `Restore ${status.missing.length} missing skill(s) from ${SKILLS_LOCKFILE}?`
      : `Install shared skills from ${SHARED_SKILLS_SOURCE}? (replaces vendored copies)`;

    if (!(await promptConfirm(options.flow, { message, default: true, cancelBehavior: 'skip' }))) {
      return { ran: false };
    }
  }

  const spin = spinner();
  spin.start(restoring ? 'Restoring skills...' : 'Installing shared skills...');

  const result = await runSkillsCli(
    restoring ? buildSkillsRestoreArgs() : buildSkillsAddArgs(),
    options.targetDir,
  );

  if (!result.ok) {
    spin.stop('Skill installation failed');
    warnMessage(`Skills were not installed: ${result.error ?? 'unknown error'}`);
    return { ran: true, error: result.error };
  }

  spin.stop(restoring ? 'Skills restored' : 'Shared skills installed');

  if (options.commit) {
    await commitSkills(options.targetDir, restoring ? RESTORE_COMMIT_MESSAGE : ADD_COMMIT_MESSAGE);
  }

  return { ran: true };
}

async function commitSkills(targetDir: string, message: string): Promise<void> {
  try {
    const commit = await commitAllChanges(targetDir, message, {
      typeChangeMessage: REMOVE_COMMIT_MESSAGE,
    });

    if (commit.preludeCommit?.hash) {
      successMessage(`Committed ${commit.preludeCommit.hash} — ${REMOVE_COMMIT_MESSAGE}`);
    }
    if (commit.committed && commit.hash) {
      successMessage(`Committed ${commit.hash} — ${commit.message ?? message}`);
    }
  } catch (error) {
    warnMessage(
      `Skills installed but not committed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
