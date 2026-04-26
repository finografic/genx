import { execa } from 'execa';

import { readDepsPolicyPath } from './managed.utils.js';

/**
 * Runs `pnpm policy:update` in the local deps-policy repo (path from genx.config.jsonc). Returns true when
 * the update ran, false when `depsPolicyPath` is not configured.
 *
 * @param silent - When true, pipes output and passes `--yes` (for --managed runs). When false, inherits stdio
 *   so interactive prompts render in the terminal.
 */
export async function runPolicyUpdate(silent: boolean): Promise<boolean> {
  const depsPolicyPath = await readDepsPolicyPath();
  if (!depsPolicyPath) return false;

  const args = silent ? ['run', 'policy:update', '--yes'] : ['run', 'policy:update'];

  await execa('pnpm', args, {
    cwd: depsPolicyPath,
    stdio: silent ? 'pipe' : 'inherit',
  });

  return true;
}
