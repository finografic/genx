import { readFile, rename, writeFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';

import {
  addExtensionRecommendations,
  addLanguageFormatterSettings,
  errorMessage,
  fileExists,
  installDevDependency,
  isDependencyDeclared,
  removeDependency,
  spinner,
  successMessage,
} from 'utils';
import {
  PACKAGE_JSON_SCRIPTS_SECTION_DIVIDER,
  PACKAGE_JSON_SCRIPTS_SECTION_PREFIX,
} from 'config/constants.config';
import type { PackageJson } from 'types/package-json.types';
import type { FeatureApplyResult, FeatureContext } from '../feature.types';
import {
  DPRINT_PACKAGE,
  DPRINT_PACKAGE_VERSION,
  DPRINT_VSCODE_EXTENSION,
  FORMATTING_SCRIPTS,
  FORMATTING_SECTION_TITLE,
  PRETTIER_CONFIG_FILES,
  PRETTIER_PACKAGE_PATTERNS,
  PRETTIER_PACKAGES,
} from './dprint.constants';
import { ensureDprintConfig } from './dprint.template';
import { getDprintLanguages } from './dprint.vscode';

/**
 * Convert a glob pattern (e.g., "*prettier-plugin-*") to a regex for matching package names.
 * Supports * as wildcard. For scoped packages, matches against the full name.
 */
function patternToRegex(pattern: string): RegExp {
  // Escape special regex chars except *
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  // Replace * with .* for regex
  const regexStr = `^${escaped.replace(/\*/g, '.*')}$`;
  return new RegExp(regexStr);
}

/**
 * Check if a package name matches any of the Prettier patterns.
 */
function matchesPrettierPattern(packageName: string): boolean {
  return PRETTIER_PACKAGE_PATTERNS.some((pattern) => {
    const regex = patternToRegex(pattern);
    return regex.test(packageName);
  });
}

/**
 * Find all Prettier-related packages in package.json (exact matches + pattern matches).
 */
async function findPrettierPackages(targetDir: string): Promise<string[]> {
  const packageJsonPath = resolve(targetDir, 'package.json');
  const raw = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(raw) as PackageJson;

  const allDeps = new Set<string>();

  // Collect from dependencies
  if (packageJson.dependencies && typeof packageJson.dependencies === 'object') {
    for (const name of Object.keys(packageJson.dependencies)) {
      allDeps.add(name);
    }
  }

  // Collect from devDependencies
  if (packageJson.devDependencies && typeof packageJson.devDependencies === 'object') {
    for (const name of Object.keys(packageJson.devDependencies)) {
      allDeps.add(name);
    }
  }

  // Find matches
  const matches: string[] = [];

  for (const dep of allDeps) {
    // Exact match
    if (PRETTIER_PACKAGES.includes(dep as (typeof PRETTIER_PACKAGES)[number])) {
      matches.push(dep);
      continue;
    }

    // Pattern match
    if (matchesPrettierPattern(dep)) {
      matches.push(dep);
    }
  }

  return matches;
}

/**
 * If Prettier is present, uninstall it and backup Prettier config files so dprint
 * can take over. Returns what was done so applyDprint can report it.
 */
async function replacePrettierIfPresent(
  targetDir: string,
): Promise<{ removedPackages: string[]; backedUp: string[] }> {
  const backedUp: string[] = [];
  const removedPackages: string[] = [];

  // 1. Find and uninstall all Prettier-related packages
  const prettierPackages = await findPrettierPackages(targetDir);
  for (const pkg of prettierPackages) {
    const result = await removeDependency(targetDir, pkg);
    if (result.removed) {
      removedPackages.push(pkg);
    }
  }

  // 2. Backup each Prettier config file that exists
  for (const file of PRETTIER_CONFIG_FILES) {
    const filePath = resolve(targetDir, file);
    if (fileExists(filePath)) {
      const ext = extname(file);
      const base = basename(file, ext || undefined);
      const backupName = base + '--backup' + (ext || '');
      const backupPath = resolve(targetDir, backupName);
      await rename(filePath, backupPath);
      backedUp.push(file);
    }
  }

  return { removedPackages, backedUp };
}

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
      if (key.startsWith(PACKAGE_JSON_SCRIPTS_SECTION_PREFIX)) {
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
    newScripts[FORMATTING_SECTION_TITLE] = PACKAGE_JSON_SCRIPTS_SECTION_DIVIDER;
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
 * Replaces Prettier if present (uninstall + backup configs), then installs
 * @finografic/dprint-config, creates dprint.jsonc, adds formatting scripts,
 * and configures VSCode settings.
 */
export async function applyDprint(context: FeatureContext): Promise<FeatureApplyResult> {
  const applied: string[] = [];

  // 0. Replace Prettier if present (uninstall, backup config files)
  const replaceResult = await replacePrettierIfPresent(context.targetDir);
  if (replaceResult.removedPackages.length > 0) {
    applied.push('removed Prettier packages');
    successMessage(`Uninstalled: ${replaceResult.removedPackages.join(', ')}`);
  }
  if (replaceResult.backedUp.length > 0) {
    applied.push('backed up Prettier config(s)');
    successMessage(`Backed up Prettier config: ${replaceResult.backedUp.join(', ')}`);
  }

  // 1. Install @finografic/dprint-config
  try {
    const alreadyDeclared = await isDependencyDeclared(context.targetDir, DPRINT_PACKAGE);
    if (!alreadyDeclared) {
      const installSpin = spinner();
      installSpin.start(`Installing ${DPRINT_PACKAGE}...`);
      const installResult = await installDevDependency(
        context.targetDir,
        DPRINT_PACKAGE,
        DPRINT_PACKAGE_VERSION,
      );
      installSpin.stop(
        installResult.installed
          ? `Installed ${DPRINT_PACKAGE}`
          : `${DPRINT_PACKAGE} already installed`,
      );
      if (installResult.installed) {
        applied.push(DPRINT_PACKAGE);
      }
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error('Unknown error');
    errorMessage(error.message);
    return { applied, error };
  }

  // 2. Create dprint.jsonc
  const result = await ensureDprintConfig(context.targetDir);
  if (result.wrote) {
    applied.push('dprint.jsonc');
    successMessage('Created dprint.jsonc');
  }

  // 3. Add formatting scripts to package.json
  const packageJsonPath = resolve(context.targetDir, 'package.json');
  const scriptsResult = await addFormattingScripts(packageJsonPath);
  if (scriptsResult.added) {
    applied.push('formatting scripts');
    successMessage('Added formatting scripts to package.json');
  }

  // 4. Configure VSCode extension recommendation
  const addedExtensions = await addExtensionRecommendations(context.targetDir, [
    DPRINT_VSCODE_EXTENSION,
  ]);
  if (addedExtensions.length > 0) {
    applied.push('.vscode/extensions.json');
    successMessage(`Added extension recommendation: ${DPRINT_VSCODE_EXTENSION}`);
  }

  // 5. Configure VSCode language formatter settings (based on project dependencies)
  const languages = await getDprintLanguages(context.targetDir);
  const settingsResult = await addLanguageFormatterSettings(
    context.targetDir,
    languages,
    DPRINT_VSCODE_EXTENSION,
  );
  if (settingsResult.addedLanguages.length > 0 || settingsResult.disabledPrettier) {
    applied.push('.vscode/settings.json');
    if (settingsResult.disabledPrettier) {
      successMessage('Disabled Prettier in VSCode settings');
    }
    if (settingsResult.addedLanguages.length > 0) {
      successMessage(
        `Configured dprint as formatter for: ${settingsResult.addedLanguages.join(', ')}`,
      );
    }
  }

  if (applied.length === 0) {
    return { applied, noopMessage: 'dprint already installed. No changes made.' };
  }

  return { applied };
}
