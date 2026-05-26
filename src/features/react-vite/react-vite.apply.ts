import { resolve } from 'node:path';
import { execa } from 'execa';
import { errorMessage, spinner } from 'utils';
import type { FeatureApplyResult, FeatureContext } from '../feature.types';

import { PACKAGE_JSON } from 'config/constants.config';

import { applyPreviewChanges } from '../../lib/feature-preview/index.js';
import { previewReactVite } from './react-vite.preview.js';

/**
 * Apply react-vite feature using preview-driven apply. Runs `pnpm install` when
 * package.json was written to ensure dependencies are installed.
 */
export async function applyReactVite(context: FeatureContext): Promise<FeatureApplyResult> {
  const preview = await previewReactVite(context);
  const result = await applyPreviewChanges(preview, { yesAll: context.yesAll });

  if (result.applied.length === 0) {
    return result;
  }

  const packageJsonPath = resolve(context.targetDir, PACKAGE_JSON);
  const packageJsonWasWritten = result.appliedTargetPaths?.includes(packageJsonPath) === true;

  if (!packageJsonWasWritten) {
    return result;
  }

  const installSpin = spinner();
  installSpin.start('Installing dependencies...');

  try {
    await execa('pnpm', ['install'], { cwd: context.targetDir });
    installSpin.stop('Dependencies installed');
    return {
      applied: [...result.applied, 'dependencies (pnpm install)'],
      appliedTargetPaths: result.appliedTargetPaths,
    };
  } catch (err) {
    installSpin.stop('Failed to install dependencies');
    const error = err instanceof Error ? err : new Error(String(err));
    errorMessage(error.message);
    return { applied: result.applied, appliedTargetPaths: result.appliedTargetPaths, error };
  }
}
