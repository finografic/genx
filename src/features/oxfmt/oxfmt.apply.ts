import { execa } from 'execa';
import { errorMessage, spinner } from 'utils';
import type { FeatureApplyResult, FeatureContext } from '../feature.types';

import { applyPreviewChanges } from '../../lib/feature-preview/index.js';
import { previewOxfmt } from './oxfmt.preview.js';

function appliedIncludesPackageJsonWrite(applied: readonly string[]): boolean {
  return applied.some((label) => label.includes('package.json'));
}

/**
 * Apply oxfmt to an existing package (Prettier → oxfmt migration path).
 * Uses `previewOxfmt` as the single source of truth for file changes, then runs `pnpm install`
 * when the manifest dependency lists change and package.json was applied.
 */
export async function applyOxfmt(context: FeatureContext): Promise<FeatureApplyResult> {
  const preview = await previewOxfmt(context);
  const result = await applyPreviewChanges(preview);

  if (result.applied.length === 0) {
    return result;
  }

  const shouldRunInstall = preview.needsInstall === true && appliedIncludesPackageJsonWrite(result.applied);

  if (!shouldRunInstall) {
    return result;
  }

  const installSpin = spinner();
  installSpin.start('Installing dependencies...');

  try {
    await execa('pnpm', ['install'], { cwd: context.targetDir });
    installSpin.stop('Dependencies installed');
    return {
      applied: [...result.applied, 'dependencies (pnpm install)'],
    };
  } catch (err) {
    installSpin.stop('Failed to install dependencies');
    const error = err instanceof Error ? err : new Error(String(err));
    errorMessage(error.message);
    return { applied: result.applied, error };
  }
}
