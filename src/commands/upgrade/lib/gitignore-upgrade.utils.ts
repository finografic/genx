import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileExists } from 'utils';

import { proposeGitignoreMerge, rewriteDotAiPathsToAgents } from 'lib/agents-gitignore.utils.js';

export interface GitignoreUpgradePlan {
  gitignorePath: string;
  current: string;
  proposed: string;
  changed: boolean;
}

/** Propose canonical `.gitignore` content for a target (creates from template when input is empty). */
export function proposeTargetGitignore(content: string): string {
  return proposeGitignoreMerge(rewriteDotAiPathsToAgents(content));
}

export async function planGitignoreUpgrade(targetDir: string): Promise<GitignoreUpgradePlan> {
  const gitignorePath = resolve(targetDir, '.gitignore');
  const exists = fileExists(gitignorePath);
  const current = exists ? await readFile(gitignorePath, 'utf8') : '';
  const proposed = proposeTargetGitignore(current);

  return {
    gitignorePath,
    current,
    proposed,
    changed: proposed !== current,
  };
}
