import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { execa } from 'execa';

export interface CloneStarterOptions {
  /** SSH clone URL of the starter repository. */
  repoUrl: string;
  /** Tag to clone. Never a branch — generation must be reproducible. */
  tag: string;
  /** Absolute path the starter is cloned into. */
  targetDir: string;
}

/**
 * Shallow-clone the monorepo starter at a pinned tag, then detach it from the starter's history so
 * the generated repository starts with its own.
 */
export async function cloneStarter({ repoUrl, tag, targetDir }: CloneStarterOptions): Promise<void> {
  try {
    await execa('git', ['clone', '--depth', '1', '--branch', tag, repoUrl, targetDir]);
  } catch (error) {
    throw new Error(
      [
        `Failed to clone ${repoUrl} at tag ${tag}.`,
        `Verify the tag exists:  git ls-remote --tags ${repoUrl}`,
        'and that your SSH key has access to the repository.',
        '',
        error instanceof Error ? error.message : String(error),
      ].join('\n'),
      { cause: error },
    );
  }

  await rm(join(targetDir, '.git'), { recursive: true, force: true });
}
