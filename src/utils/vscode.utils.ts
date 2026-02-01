/**
 * VSCode configuration utilities.
 *
 * Handles creation and modification of .vscode folder and its configuration files.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { VSCodeExtensionsJson, VSCodeSettingsJson } from 'types/vscode.types';
import { fileExists } from './fs.utils';

/** Base template for .vscode/extensions.json */
const BASE_EXTENSIONS_JSON: VSCodeExtensionsJson = {
  recommendations: [],
  unwantedRecommendations: [],
};

/** Base template for .vscode/settings.json */
const BASE_SETTINGS_JSON: VSCodeSettingsJson = {
  'npm.packageManager': 'pnpm',
  'editor.formatOnSave': true,
  'eslint.enable': true,
  'eslint.useFlatConfig': true,
};

/**
 * Ensure the .vscode directory exists.
 */
export async function ensureVSCodeDir(targetDir: string): Promise<void> {
  const vscodeDir = resolve(targetDir, '.vscode');
  await mkdir(vscodeDir, { recursive: true });
}

/**
 * Read the .vscode/extensions.json file, or return the base template if it doesn't exist.
 */
export async function readExtensionsJson(targetDir: string): Promise<VSCodeExtensionsJson> {
  const filePath = resolve(targetDir, '.vscode', 'extensions.json');

  if (!fileExists(filePath)) {
    return { ...BASE_EXTENSIONS_JSON };
  }

  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as VSCodeExtensionsJson;
}

/**
 * Write the .vscode/extensions.json file.
 */
export async function writeExtensionsJson(
  targetDir: string,
  content: VSCodeExtensionsJson,
): Promise<void> {
  await ensureVSCodeDir(targetDir);
  const filePath = resolve(targetDir, '.vscode', 'extensions.json');
  const formatted = `${JSON.stringify(content, null, 2)}\n`;
  await writeFile(filePath, formatted, 'utf8');
}

/**
 * Add extension recommendations to .vscode/extensions.json.
 * Returns the list of extensions that were actually added (not already present).
 */
export async function addExtensionRecommendations(
  targetDir: string,
  extensions: string[],
): Promise<string[]> {
  const content = await readExtensionsJson(targetDir);
  const recommendations = content.recommendations ?? [];
  const added: string[] = [];

  for (const ext of extensions) {
    if (!recommendations.includes(ext)) {
      recommendations.push(ext);
      added.push(ext);
    }
  }

  if (added.length > 0) {
    content.recommendations = recommendations;
    await writeExtensionsJson(targetDir, content);
  }

  return added;
}

/**
 * Read the .vscode/settings.json file, or return the base template if it doesn't exist.
 */
export async function readSettingsJson(targetDir: string): Promise<VSCodeSettingsJson> {
  const filePath = resolve(targetDir, '.vscode', 'settings.json');

  if (!fileExists(filePath)) {
    return { ...BASE_SETTINGS_JSON };
  }

  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as VSCodeSettingsJson;
}

/**
 * Write the .vscode/settings.json file.
 */
export async function writeSettingsJson(
  targetDir: string,
  content: VSCodeSettingsJson,
): Promise<void> {
  await ensureVSCodeDir(targetDir);
  const filePath = resolve(targetDir, '.vscode', 'settings.json');
  const formatted = `${JSON.stringify(content, null, 2)}\n`;
  await writeFile(filePath, formatted, 'utf8');
}

/**
 * Add language-specific formatter settings to .vscode/settings.json.
 * @param targetDir - Target directory
 * @param languages - Array of language IDs (e.g., "typescript", "javascript")
 * @param formatterId - VSCode formatter ID (e.g., "dprint.dprint")
 * @returns Object with added languages and whether prettier was disabled
 */
export async function addLanguageFormatterSettings(
  targetDir: string,
  languages: string[],
  formatterId: string,
): Promise<{ addedLanguages: string[]; disabledPrettier: boolean }> {
  const content = await readSettingsJson(targetDir);
  const addedLanguages: string[] = [];
  let disabledPrettier = false;

  // Disable prettier if not already disabled
  if (content['prettier.enable'] !== false) {
    content['prettier.enable'] = false;
    disabledPrettier = true;
  }

  for (const lang of languages) {
    const key = `[${lang}]` as const;
    const existing = content[key] ?? {};

    // Only add if formatter not already set
    if (!existing['editor.defaultFormatter']) {
      content[key] = {
        ...existing,
        'editor.defaultFormatter': formatterId,
      };
      addedLanguages.push(lang);
    }
  }

  if (addedLanguages.length > 0 || disabledPrettier) {
    await writeSettingsJson(targetDir, content);
  }

  return { addedLanguages, disabledPrettier };
}

/**
 * Check if a .vscode folder exists in the target directory.
 */
export function hasVSCodeDir(targetDir: string): boolean {
  return fileExists(resolve(targetDir, '.vscode'));
}

/**
 * Check if .vscode/extensions.json exists.
 */
export function hasExtensionsJson(targetDir: string): boolean {
  return fileExists(resolve(targetDir, '.vscode', 'extensions.json'));
}

/**
 * Check if .vscode/settings.json exists.
 */
export function hasSettingsJson(targetDir: string): boolean {
  return fileExists(resolve(targetDir, '.vscode', 'settings.json'));
}
