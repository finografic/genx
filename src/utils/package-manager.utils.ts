import { execa } from 'execa';

/**
 * Install a package as a dev dependency using pnpm.
 * Generic utility for feature installation.
 */
export async function installDevDependency(
  targetDir: string,
  packageName: string,
  version: string = 'latest',
): Promise<{ installed: boolean }> {
  try {
    // Note: we intentionally run pnpm here instead of editing package.json
    // directly, so lockfiles stay consistent.
    await execa('pnpm', ['add', '-D', `${packageName}@${version}`], {
      cwd: targetDir,
    });
    return { installed: true };
  } catch (error) {
    // If pnpm exits non-zero for an already-present dependency in some setups,
    // treat that as a non-failure. (This keeps feature application idempotent.)
    if (error instanceof Error && error.message.toLowerCase().includes('already')) {
      return { installed: false };
    }
    throw error;
  }
}
