import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isDependencyDeclared } from 'utils';
import type { FeatureContext } from '../feature.types';

import type { PackageJson } from 'types/package-json.types';
import { OXFMT_CONFIG_PACKAGE } from './oxfmt.constants';

function hasFormattingScripts(scripts: Record<string, string>): boolean {
  return 'format:check' in scripts || 'format:fix' in scripts;
}

/**
 * Detect if oxfmt is already fully configured in the target directory.
 * Signals (all must be true):
 *   1. `oxfmt` declared as a devDependency
 *   2. `@finografic/oxfmt-config` declared as a devDependency
 *   3. `format:check` or `format:fix` script present
 */
export async function detectOxfmt(context: FeatureContext): Promise<boolean> {
  const packageJsonPath = resolve(context.targetDir, 'package.json');
  const raw = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(raw) as PackageJson;

  const hasOxfmt = await isDependencyDeclared(context.targetDir, 'oxfmt');
  if (!hasOxfmt) return false;

  const hasConfig = await isDependencyDeclared(context.targetDir, OXFMT_CONFIG_PACKAGE);
  if (!hasConfig) return false;

  const scripts = packageJson.scripts ?? {};
  return hasFormattingScripts(scripts);
}
