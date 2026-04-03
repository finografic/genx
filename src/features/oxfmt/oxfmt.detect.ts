import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileExists, isDependencyDeclared } from 'utils';
import type { FeatureContext } from '../feature.types';

import type { PackageJson } from 'types/package-json.types';
import { OXFMT_CONFIG_PACKAGE } from './oxfmt.constants';

function hasFormattingScripts(scripts: Record<string, string>): boolean {
  return 'format.check' in scripts || 'format.fix' in scripts;
}

/**
 * Detect if oxfmt is already fully configured in the target directory.
 */
export async function detectOxfmt(context: FeatureContext): Promise<boolean> {
  const oxfmtConfigPath = resolve(context.targetDir, 'oxfmt.config.ts');
  if (!fileExists(oxfmtConfigPath)) return false;

  const packageJsonPath = resolve(context.targetDir, 'package.json');
  const raw = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(raw) as PackageJson;

  const scripts = packageJson.scripts ?? {};

  const hasConfig = await isDependencyDeclared(context.targetDir, OXFMT_CONFIG_PACKAGE);
  if (!hasConfig) return false;

  return hasFormattingScripts(scripts);
}
