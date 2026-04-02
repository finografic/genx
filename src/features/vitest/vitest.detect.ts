import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileExists, isDependencyDeclared } from 'utils';
import type { FeatureContext } from '../feature.types';

import type { PackageJson } from 'types/package-json.types';
import { VITEST_PACKAGE } from './vitest.constants';

function hasTestingScripts(scripts: Record<string, string>): boolean {
  return 'test' in scripts || 'test.run' in scripts || 'test.coverage' in scripts;
}

/**
 * Detect if vitest feature is already present in the target directory.
 */
export async function detectVitest(context: FeatureContext): Promise<boolean> {
  const vitestConfigPath = resolve(context.targetDir, 'vitest.config.ts');
  if (!fileExists(vitestConfigPath)) return false;

  const packageJsonPath = resolve(context.targetDir, 'package.json');
  const raw = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(raw) as PackageJson;

  const scripts = packageJson.scripts ?? {};

  const hasVitestDep = await isDependencyDeclared(context.targetDir, VITEST_PACKAGE);
  if (!hasVitestDep) return false;

  return hasTestingScripts(scripts);
}
