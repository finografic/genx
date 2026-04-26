import { resolve } from 'node:path';
import { execa } from 'execa';
import { errorMessage, spinner, warnMessage } from 'utils';
import type { FeatureApplyResult, FeatureContext } from '../feature.types';

import { PACKAGE_JSON } from 'config/constants.config';

import { applyPreviewChanges } from '../../lib/feature-preview/index.js';
import { previewGitHooks } from './git-hooks.preview.js';

/**
 * Apply git-hooks feature using `previewGitHooks` + `applyPreviewChanges`, then `pnpm install` when
 * package.json dependency lists change. Successful install already runs `prepare` (husky).
 */
export async function applyGitHooks(context: FeatureContext): Promise<FeatureApplyResult> {
  const preview = await previewGitHooks(context);
  const result = await applyPreviewChanges(preview, { yesAll: context.yesAll });

  if (result.applied.length === 0) {
    return result;
  }

  const packageJsonPath = resolve(context.targetDir, PACKAGE_JSON);
  const shouldRunInstall =
    preview.needsInstall === true && result.appliedTargetPaths?.includes(packageJsonPath) === true;

  if (!shouldRunInstall) {
    warnMessage('Run "pnpm prepare" to activate git hooks');
    return result;
  }

  const installSpin = spinner();
  installSpin.start('Installing dependencies...');

  try {
    await execa('pnpm', ['install'], { cwd: context.targetDir });
    installSpin.stop('Dependencies installed');
    // `prepare` (husky) runs during install — no extra step for the common path.
    return {
      applied: [...result.applied, 'dependencies (pnpm install)'],
      appliedTargetPaths: result.appliedTargetPaths,
    };
  } catch (err) {
    installSpin.stop('Failed to install dependencies');
    const error = err instanceof Error ? err : new Error(String(err));
    errorMessage(error.message);
    warnMessage('After fixing install, run "pnpm prepare" to activate git hooks');
    return { applied: result.applied, appliedTargetPaths: result.appliedTargetPaths, error };
  }
}
