import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { fileExists, isDependencyDeclared } from 'utils';
import type { PackageJson } from 'types/package-json.types';
import type { FeatureContext } from '../feature.types';
import { DPRINT_PACKAGE } from './dprint.constants';

function hasFormattingScripts(scripts: Record<string, string>): boolean {
  return 'format.check' in scripts || 'format.fix' in scripts;
}

/**
 * Detect if dprint feature is already present in the target directory.
 */
export async function detectDprint(context: FeatureContext): Promise<boolean> {
  const dprintConfigPath = resolve(context.targetDir, 'dprint.jsonc');
  if (!fileExists(dprintConfigPath)) return false;

  const packageJsonPath = resolve(context.targetDir, 'package.json');
  const raw = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(raw) as PackageJson;

  const scripts = packageJson.scripts ?? {};

  const hasDprintDep = await isDependencyDeclared(context.targetDir, DPRINT_PACKAGE);
  if (!hasDprintDep) return false;

  return hasFormattingScripts(scripts);
}
