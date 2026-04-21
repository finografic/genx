/**
 * Oxfmt VSCode configuration — oxc.oxc-vscode as formatter by language.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  addExtensionRecommendations,
  addLanguageFormatterSettings,
  BASE_SETTINGS_JSON,
  ensureMarkdownlintConfigAndStylesAtEnd,
  ensureOxfmtSharedSettingsBeforePrettier,
  ensureVSCodeDir,
  fileExists,
  hasAnyDependency,
  readExtensionsJson,
  writeExtensionsJson,
} from 'utils';
import type { OxfmtLanguageCategory } from './oxc-config.constants';

import {
  OXFMT_CATEGORY_DEPENDENCIES,
  OXFMT_FORMATTER_ID,
  OXFMT_LANGUAGE_CATEGORIES,
  OXFMT_VSCODE_EXTENSIONS,
} from './oxc-config.constants';

async function detectEnabledCategories(targetDir: string): Promise<OxfmtLanguageCategory[]> {
  const enabledCategories: OxfmtLanguageCategory[] = [];

  for (const [category, dependencies] of Object.entries(OXFMT_CATEGORY_DEPENDENCIES)) {
    const categoryKey = category as OxfmtLanguageCategory;

    if (dependencies === null) {
      enabledCategories.push(categoryKey);
      continue;
    }

    if (await hasAnyDependency(targetDir, dependencies)) {
      enabledCategories.push(categoryKey);
    }
  }

  return enabledCategories;
}

async function getOxfmtLanguages(targetDir: string): Promise<string[]> {
  const categories = await detectEnabledCategories(targetDir);
  const languages: string[] = [];

  for (const category of categories) {
    const categoryLanguages = OXFMT_LANGUAGE_CATEGORIES[category];
    for (const lang of categoryLanguages) {
      if (!languages.includes(lang)) {
        languages.push(lang);
      }
    }
  }

  return languages;
}

/**
 * Recommend oxc VSCode extension and mark Prettier as unwanted.
 */
export async function applyOxfmtExtensions(targetDir: string): Promise<string[]> {
  const added = await addExtensionRecommendations(targetDir, [...OXFMT_VSCODE_EXTENSIONS]);

  const content = await readExtensionsJson(targetDir);
  const prev = content.unwantedRecommendations ?? [];
  const merged = [...new Set([...prev, 'esbenp.prettier-vscode'])].sort();
  const prevSorted = [...prev].sort();
  const unwantedChanged = merged.length !== prevSorted.length || merged.some((id, i) => id !== prevSorted[i]);

  if (unwantedChanged) {
    content.unwantedRecommendations = merged;
    await writeExtensionsJson(targetDir, content);
  }

  return added;
}

export async function applyOxfmtFormatterSettings(
  targetDir: string,
): Promise<{ addedLanguages: string[]; disabledPrettier: boolean }> {
  const languages = await getOxfmtLanguages(targetDir);
  return addLanguageFormatterSettings(targetDir, languages, OXFMT_FORMATTER_ID);
}

/**
 * Core editor settings aligned with oxfmt + ESLint flat config.
 */
export async function applyOxfmtSharedVSCodeSettings(targetDir: string): Promise<boolean> {
  const filePath = resolve(targetDir, '.vscode', 'settings.json');
  await ensureVSCodeDir(targetDir);

  let text: string;
  if (!fileExists(filePath)) {
    text = `${JSON.stringify({ ...BASE_SETTINGS_JSON }, null, 2)}\n`;
    await writeFile(filePath, text, 'utf8');
  } else {
    text = await readFile(filePath, 'utf8');
  }

  let { text: next, changed } = ensureOxfmtSharedSettingsBeforePrettier(text, OXFMT_FORMATTER_ID);
  const tail = ensureMarkdownlintConfigAndStylesAtEnd(next);
  if (tail.changed) {
    next = tail.text;
    changed = true;
  }
  if (changed) {
    await writeFile(filePath, next, 'utf8');
  }

  return changed;
}
