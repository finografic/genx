import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  errorMessage,
  fileExists,
  installDevDependency,
  isDependencyDeclared,
  spinner,
  successMessage,
} from 'utils';
import type { FeatureApplyResult, FeatureContext } from '../feature.types';

import { findPackageRoot } from 'utils/package-root.utils';
import {
  PACKAGE_JSON_SCRIPTS_SECTION_DIVIDER,
  PACKAGE_JSON_SCRIPTS_SECTION_PREFIX,
} from 'config/constants.config';
import type { PackageJson } from 'types/package-json.types';
import {
  TEST_SCRIPTS,
  TESTING_SECTION_TITLE,
  VITEST_PACKAGE,
  VITEST_PACKAGE_VERSION,
} from './vitest.constants';

/**
 * Check if testing scripts section already exists in package.json.
 */
function hasTestingScripts(scripts: Record<string, string>): boolean {
  return 'test' in scripts || 'test:run' in scripts || 'test:coverage' in scripts;
}

/**
 * Check if testing section title exists in scripts.
 */
function hasTestingSectionTitle(scripts: Record<string, string>): boolean {
  return Object.keys(scripts).some((key) => key === TESTING_SECTION_TITLE);
}

/**
 * Find the insertion point for testing scripts in package.json scripts.
 * Returns the index after the last script before where testing should go,
 * or -1 if testing section already exists.
 */
function findTestingInsertionPoint(scripts: Record<string, string>): number {
  // If testing already exists, don't insert
  if (hasTestingScripts(scripts)) {
    return -1;
  }

  const scriptKeys = Object.keys(scripts);

  // Find the index after "·········· BUILD" section
  const buildIndex = scriptKeys.findIndex((key) => key.includes('BUILD'));
  if (buildIndex !== -1) {
    // Find the last script in the build section
    let insertAfter = buildIndex;
    for (let i = buildIndex + 1; i < scriptKeys.length; i++) {
      const key = scriptKeys[i];
      // Stop if we hit another section title
      if (key.startsWith(PACKAGE_JSON_SCRIPTS_SECTION_PREFIX)) {
        break;
      }
      insertAfter = i;
    }
    return insertAfter + 1;
  }

  // If no build section, insert after the last script
  return scriptKeys.length;
}

/**
 * Add testing scripts to package.json.
 * Inserts the testing section after the build section if it doesn't already exist.
 */
async function addTestingScripts(packageJsonPath: string): Promise<{ added: boolean; changes: string[] }> {
  const raw = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(raw) as PackageJson;

  const scripts = { ...(packageJson.scripts ?? {}) };

  // Check if testing scripts already exist
  if (hasTestingScripts(scripts)) {
    return { added: false, changes: [] };
  }

  const changes: string[] = [];
  const scriptKeys = Object.keys(scripts);
  const insertionPoint = findTestingInsertionPoint(scripts);

  if (insertionPoint === -1) {
    return { added: false, changes: [] };
  }

  // Build new scripts object with testing section inserted
  const newScripts: Record<string, string> = {};

  // Copy scripts up to insertion point
  for (let i = 0; i < insertionPoint; i++) {
    const key = scriptKeys[i];
    newScripts[key] = scripts[key];
  }

  // Insert testing section
  if (!hasTestingSectionTitle(scripts)) {
    newScripts[TESTING_SECTION_TITLE] = PACKAGE_JSON_SCRIPTS_SECTION_DIVIDER;
    changes.push(`scripts.${TESTING_SECTION_TITLE}`);
  }

  for (const [scriptKey, scriptValue] of Object.entries(TEST_SCRIPTS)) {
    newScripts[scriptKey] = scriptValue;
    changes.push(`scripts.${scriptKey}`);
  }

  // Copy remaining scripts after insertion point
  for (let i = insertionPoint; i < scriptKeys.length; i++) {
    const key = scriptKeys[i];
    newScripts[key] = scripts[key];
  }

  packageJson.scripts = newScripts;

  const formatted = `${JSON.stringify(packageJson, null, 2)}\n`;
  await writeFile(packageJsonPath, formatted, 'utf8');

  return { added: changes.length > 0, changes };
}

/**
 * Ensure vitest.config.ts exists by copying from template.
 */
async function ensureVitestConfig(context: FeatureContext): Promise<{ wrote: boolean }> {
  const vitestConfigPath = resolve(context.targetDir, 'vitest.config.ts');

  if (fileExists(vitestConfigPath)) {
    return { wrote: false };
  }

  // Get template directory
  const fromDir = fileURLToPath(new URL('.', import.meta.url));
  const packageRoot = findPackageRoot(fromDir);
  const templateVitestConfigPath = resolve(packageRoot, '_templates/vitest.config.ts');

  if (!fileExists(templateVitestConfigPath)) {
    throw new Error('Template vitest.config.ts not found');
  }

  const templateContent = await readFile(templateVitestConfigPath, 'utf8');
  await writeFile(vitestConfigPath, templateContent, 'utf8');

  return { wrote: true };
}

/**
 * Apply vitest feature to an existing package.
 * Installs vitest, creates vitest.config.ts, and adds testing scripts.
 */
export async function applyVitest(context: FeatureContext): Promise<FeatureApplyResult> {
  const applied: string[] = [];

  // 1. Install vitest
  try {
    const alreadyDeclared = await isDependencyDeclared(context.targetDir, VITEST_PACKAGE);
    if (!alreadyDeclared) {
      const installSpin = spinner();
      installSpin.start(`Installing ${VITEST_PACKAGE}...`);
      const installResult = await installDevDependency(
        context.targetDir,
        VITEST_PACKAGE,
        VITEST_PACKAGE_VERSION,
      );
      installSpin.stop(
        installResult.installed ? `Installed ${VITEST_PACKAGE}` : `${VITEST_PACKAGE} already installed`,
      );
      if (installResult.installed) {
        applied.push(VITEST_PACKAGE);
      }
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error('Unknown error');
    errorMessage(error.message);
    return { applied, error };
  }

  // 2. Create vitest.config.ts
  const result = await ensureVitestConfig(context);
  if (result.wrote) {
    applied.push('vitest.config.ts');
    successMessage('Created vitest.config.ts');
  }

  // 3. Add testing scripts to package.json
  const packageJsonPath = resolve(context.targetDir, 'package.json');
  const scriptsResult = await addTestingScripts(packageJsonPath);
  if (scriptsResult.added) {
    applied.push('testing scripts');
    successMessage('Added testing scripts to package.json');
  }

  if (applied.length === 0) {
    return { applied, noopMessage: 'Vitest already installed. No changes made.' };
  }

  return { applied };
}
