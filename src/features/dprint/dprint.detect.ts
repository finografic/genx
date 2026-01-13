import { resolve } from 'node:path';

import { fileExists } from 'utils/fs.utils';
import type { FeatureContext } from '../feature.types';

/**
 * Detect if dprint feature is already present in the target directory.
 */
export async function detectDprint(ctx: FeatureContext): Promise<boolean> {
  const dprintConfigPath = resolve(ctx.targetDir, 'dprint.jsonc');
  return fileExists(dprintConfigPath);
}
