import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { errorMessage, infoMessage, installDevDependency, spinner, successMessage } from 'utils';
import type { PackageJson } from 'types/package-json.types';
import type { FeatureApplyResult, FeatureContext } from '../feature.types';
import {
  DPRINT_PACKAGE,
  DPRINT_PACKAGE_VERSION,
  FORMATTING_SCRIPTS,
  FORMATTING_SECTION_TITLE,
} from './dprint.config';
import { ensureDprintConfig } from './dprint.template';

/**
 * Check if formatting scripts section already exists in package.json.
 */
function hasFormattingScripts(scripts: Record<string, string>): boolean {
  return 'format' in scripts || 'format.check' in scripts;
}

/**
 * Check if formatting section title exists in scripts.
 * Looks for the decorative title line that precedes formatting scripts.
 */
function hasFormattingSectionTitle(scripts: Record<string, string>): boolean {
  return Object.keys(scripts).some((key) => key === FORMATTING_SECTION_TITLE);
}

/**
 * Find the insertion point for formatting scripts in package.json scripts.
 * Returns the index after the last script before where formatting should go,
 * or -1 if formatting section already exists.
 */
function findFormattingInsertionPoint(scripts: Record<string, string>): number {
  // If formatting already exists, don't insert
  if (hasFormattingScripts(scripts)) {
    return -1;
  }

  const scriptKeys = Object.keys(scripts);

  // Find the index after "·········· LINTING" section
  const lintingIndex = scriptKeys.findIndex((key) => key.includes('LINTING'));
  if (lintingIndex !== -1) {
    // Find the last script in the linting section
    let insertAfter = lintingIndex;
    for (let i = lintingIndex + 1; i < scriptKeys.length; i++) {
      const key = scriptKeys[i];
      // Stop if we hit another section title
      if (key.startsWith('··········')) {
        break;
      }
      insertAfter = i;
    }
    return insertAfter + 1;
  }

  // If no linting section, insert after the last script
  return scriptKeys.length;
}

/**
 * Add formatting scripts to package.json.
 * Inserts the formatting section after the linting section if it doesn't already exist.
 */
async function addFormattingScripts(
  packageJsonPath: string,
): Promise<{ added: boolean; changes: string[] }> {
  const raw = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(raw) as PackageJson;

  const scripts = { ...(packageJson.scripts ?? {}) };

  // Check if formatting scripts already exist
  if (hasFormattingScripts(scripts)) {
    return { added: false, changes: [] };
  }

  const changes: string[] = [];
  const scriptKeys = Object.keys(scripts);
  const insertionPoint = findFormattingInsertionPoint(scripts);

  if (insertionPoint === -1) {
    return { added: false, changes: [] };
  }

  // Build new scripts object with formatting section inserted
  const newScripts: Record<string, string> = {};

  // Copy scripts up to insertion point
  for (let i = 0; i < insertionPoint; i++) {
    const key = scriptKeys[i];
    newScripts[key] = scripts[key];
  }

  // Insert formatting section
  if (!hasFormattingSectionTitle(scripts)) {
    newScripts[FORMATTING_SECTION_TITLE] = '················································';
    changes.push(`scripts.${FORMATTING_SECTION_TITLE}`);
  }

  for (const [scriptKey, scriptValue] of Object.entries(FORMATTING_SCRIPTS)) {
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
 * Apply dprint feature to an existing package.
 * Installs @finografic/dprint-config, creates dprint.jsonc, and adds formatting scripts.
 */
export async function applyDprint(ctx: FeatureContext): Promise<FeatureApplyResult> {
  const applied: string[] = [];

  // 1. Install @finografic/dprint-config
  const installSpin = spinner();
  installSpin.start(`Installing ${DPRINT_PACKAGE}...`);
  try {
    const installResult = await installDevDependency(ctx.targetDir, DPRINT_PACKAGE, DPRINT_PACKAGE_VERSION);
    installSpin.stop(
      installResult.installed
        ? `Installed ${DPRINT_PACKAGE}`
        : `${DPRINT_PACKAGE} already installed`,
    );
    if (installResult.installed) {
      applied.push(DPRINT_PACKAGE);
    }
  } catch (err) {
    installSpin.stop(`Failed to install ${DPRINT_PACKAGE}`);
    const error = err instanceof Error ? err : new Error('Unknown error');
    errorMessage(error.message);
    return { applied, error };
  }

  // 2. Create dprint.jsonc
  const result = await ensureDprintConfig(ctx.targetDir);
  if (result.wrote) {
    applied.push('dprint.jsonc');
    successMessage(`Created ${result.path}`);
  } else {
    infoMessage(`dprint.jsonc already exists at ${result.path}`);
  }

  // 3. Add formatting scripts to package.json
  const packageJsonPath = resolve(ctx.targetDir, 'package.json');
  const scriptsResult = await addFormattingScripts(packageJsonPath);
  if (scriptsResult.added) {
    applied.push('formatting scripts');
    successMessage(
      `Added formatting scripts to package.json: ${scriptsResult.changes.join(', ')}`,
    );
  } else {
    infoMessage('Formatting scripts already exist in package.json');
  }

  return { applied };
}
