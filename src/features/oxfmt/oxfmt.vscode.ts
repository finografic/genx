/**
 * oxfmt VSCode configuration — oxc.oxc-vscode as formatter by language.
 */

import {
  addExtensionRecommendations,
  addLanguageFormatterSettings,
  hasAnyDependency,
  readExtensionsJson,
  readSettingsJson,
  writeExtensionsJson,
  writeSettingsJson,
} from 'utils';

import {
  OXFMT_CATEGORY_DEPENDENCIES,
  OXFMT_FORMATTER_ID,
  OXFMT_LANGUAGE_CATEGORIES,
  OXFMT_VSCODE_EXTENSIONS,
  type OxfmtLanguageCategory,
} from './oxfmt.constants';

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
  const settings = await readSettingsJson(targetDir);
  let modified = false;

  if (settings['editor.formatOnSaveMode'] !== 'file') {
    settings['editor.formatOnSaveMode'] = 'file';
    modified = true;
  }
  if (settings['editor.defaultFormatter'] !== OXFMT_FORMATTER_ID) {
    settings['editor.defaultFormatter'] = OXFMT_FORMATTER_ID;
    modified = true;
  }
  if (settings['prettier.enable'] !== false) {
    settings['prettier.enable'] = false;
    modified = true;
  }
  if (settings['oxc.typeAware'] !== true) {
    settings['oxc.typeAware'] = true;
    modified = true;
  }

  if (modified) {
    await writeSettingsJson(targetDir, settings);
  }

  return modified;
}
