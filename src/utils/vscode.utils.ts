/**
 * VSCode configuration utilities.
 *
 * Handles creation and modification of .vscode folder and its configuration files.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { VSCodeExtensionsJson, VSCodeSettingsJson } from 'types/vscode.types';

import { fileExists } from './fs.utils';
import { parseJsoncObject } from './jsonc.utils';
import {
  ensureMarkdownlintConfigAndStylesAtEnd,
  setLanguageFormatterBlock,
  setRootPropertyJsonc,
} from './vscode-jsonc.utils';

/** Base template for .vscode/extensions.json */
const BASE_EXTENSIONS_JSON: VSCodeExtensionsJson = {
  recommendations: [],
};

/** Base template for .vscode/settings.json */
export const BASE_SETTINGS_JSON: VSCodeSettingsJson = {
  'npm.packageManager': 'pnpm',
  'editor.formatOnSave': true,
  'editor.formatOnSaveMode': 'file',
  'editor.defaultFormatter': 'oxc.oxc-vscode',
  'editor.codeActionsOnSave': { 'source.fixAll.oxc': 'explicit', 'source.organizeImports': 'explicit' },
  'eslint.enable': false,
  'eslint.validate': ['javascript', 'typescript'],
  'prettier.enable': false,
  'oxc.typeAware': true,
  'oxc.lint.run': 'onSave',
  'typescript.tsdk': 'node_modules/typescript/lib',
  'typescript.preferences.preferTypeOnlyAutoImports': true,
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
  return parseJsoncObject(raw) as VSCodeExtensionsJson;
}

/**
 * Write the .vscode/extensions.json file.
 */
export async function writeExtensionsJson(targetDir: string, content: VSCodeExtensionsJson): Promise<void> {
  await ensureVSCodeDir(targetDir);
  const filePath = resolve(targetDir, '.vscode', 'extensions.json');
  // DEPRECATED: unwantedRecommendations — remove the field on every write.
  const { unwantedRecommendations: _removed, ...rest } = content;
  const formatted = `${JSON.stringify(rest, null, 2)}\n`;
  await writeFile(filePath, formatted, 'utf8');
}

/**
 * Add extension recommendations to .vscode/extensions.json. Returns the list of extensions that were actually
 * added (not already present).
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
  return parseJsoncObject(raw) as VSCodeSettingsJson;
}

/**
 * Write the .vscode/settings.json file.
 */
export async function writeSettingsJson(targetDir: string, content: VSCodeSettingsJson): Promise<void> {
  await ensureVSCodeDir(targetDir);
  const filePath = resolve(targetDir, '.vscode', 'settings.json');
  const formatted = `${JSON.stringify(content, null, 2)}\n`;
  await writeFile(filePath, formatted, 'utf8');
}

/**
 * Add language-specific formatter settings to .vscode/settings.json.
 *
 * @param targetDir - Target directory
 * @param languages - Array of language IDs (e.g., "typescript", "javascript")
 * @param formatterId - VSCode formatter ID (e.g., "oxc.oxc-vscode")
 * @returns Object with added languages and whether prettier was disabled
 */
export async function addLanguageFormatterSettings(
  targetDir: string,
  languages: string[],
  formatterId: string,
): Promise<{ addedLanguages: string[]; disabledPrettier: boolean }> {
  const filePath = resolve(targetDir, '.vscode', 'settings.json');
  await ensureVSCodeDir(targetDir);

  let text: string;
  if (!fileExists(filePath)) {
    text = `${JSON.stringify({ ...BASE_SETTINGS_JSON }, null, 2)}\n`;
  } else {
    text = await readFile(filePath, 'utf8');
  }

  const addedLanguages: string[] = [];
  let t = text;
  let anyChange = false;

  const root0 = parseJsoncObject(t);
  let disabledPrettier = false;
  if (root0['prettier.enable'] !== false) {
    t = setRootPropertyJsonc(t, 'prettier.enable', false);
    disabledPrettier = true;
    anyChange = true;
  }

  for (const lang of languages) {
    const r = setLanguageFormatterBlock(t, lang, formatterId);
    if (r.changed) {
      t = r.text;
      anyChange = true;
      addedLanguages.push(lang);
    }
  }

  const tail = ensureMarkdownlintConfigAndStylesAtEnd(t);
  if (tail.changed) {
    t = tail.text;
    anyChange = true;
  }

  if (anyChange) {
    await writeFile(filePath, t, 'utf8');
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
