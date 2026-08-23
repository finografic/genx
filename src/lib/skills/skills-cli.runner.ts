import { execa } from 'execa';

import {
  SHARED_SKILLS_SOURCE,
  SKILLS_CLI_AGENTS,
  SKILLS_CLI_PACKAGE,
  SKILLS_CLI_VERSION,
} from './skills.constants.js';

export interface SkillsCliResult {
  ok: boolean;
  /** Failure reason, for reporting. Never thrown — a CLI failure must not abort an upgrade. */
  error?: string;
}

/** `pnpm --package=skills@<pinned> dlx skills …` — the same `dlx` pinning idiom as `pnpm clean`. */
function dlxPrefix(): string[] {
  return [`--package=${SKILLS_CLI_PACKAGE}@${SKILLS_CLI_VERSION}`, 'dlx', SKILLS_CLI_PACKAGE];
}

/** Install every skill from the shared repository, non-interactively, to both agent containers. */
export function buildSkillsAddArgs(source: string = SHARED_SKILLS_SOURCE): string[] {
  return [
    ...dlxPrefix(),
    'add',
    source,
    ...SKILLS_CLI_AGENTS.flatMap((agent) => ['--agent', agent]),
    '--skill',
    '*',
    '--yes',
  ];
}

/** Deterministically restore the skills named in `skills-lock.json`. */
export function buildSkillsRestoreArgs(): string[] {
  return [...dlxPrefix(), 'experimental_install'];
}

/**
 * Run the CLI. Never throws.
 *
 * Skill installation reaches the network, and an upgrade that is otherwise filesystem-local must
 * not abort because GitHub was briefly unreachable. Callers report the failure and carry on.
 */
export async function runSkillsCli(args: readonly string[], cwd: string): Promise<SkillsCliResult> {
  try {
    await execa('pnpm', [...args], { cwd });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
