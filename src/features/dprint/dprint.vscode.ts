/**
 * dprint VSCode configuration utilities.
 *
 * Handles intelligent detection of which language categories should be
 * configured for dprint based on project dependencies.
 */

import {
  addExtensionRecommendations,
  addLanguageFormatterSettings,
  hasAnyDependency,
  readSettingsJson,
  writeSettingsJson,
} from 'utils';
import {
  DPRINT_CATEGORY_DEPENDENCIES,
  DPRINT_LANGUAGE_CATEGORIES,
  DPRINT_VSCODE_EXTENSIONS,
  type DprintLanguageCategory,
} from './dprint.constants';

/**
 * Determine which language categories should be enabled based on project dependencies.
 */
export async function detectEnabledCategories(
  targetDir: string,
): Promise<DprintLanguageCategory[]> {
  const enabledCategories: DprintLanguageCategory[] = [];

  for (const [category, dependencies] of Object.entries(DPRINT_CATEGORY_DEPENDENCIES)) {
    const categoryKey = category as DprintLanguageCategory;

    // If dependencies is null, category is always enabled
    if (dependencies === null) {
      enabledCategories.push(categoryKey);
      continue;
    }

    // Check if any of the trigger dependencies are present
    if (await hasAnyDependency(targetDir, dependencies)) {
      enabledCategories.push(categoryKey);
    }
  }

  return enabledCategories;
}

/**
 * Get the list of language IDs that should be configured for dprint
 * based on project dependencies.
 */
export async function getDprintLanguages(targetDir: string): Promise<string[]> {
  const categories = await detectEnabledCategories(targetDir);
  const languages: string[] = [];

  for (const category of categories) {
    const categoryLanguages = DPRINT_LANGUAGE_CATEGORIES[category];
    for (const lang of categoryLanguages) {
      if (!languages.includes(lang)) {
        languages.push(lang);
      }
    }
  }

  return languages;
}

/**
 * Add dprint extension recommendations to .vscode/extensions.json.
 * Returns the list of extensions that were actually added.
 */
export async function applyDprintExtensions(targetDir: string): Promise<string[]> {
  return addExtensionRecommendations(targetDir, [...DPRINT_VSCODE_EXTENSIONS]);
}

/**
 * Configure dprint as the default formatter for applicable languages in .vscode/settings.json.
 * Language list is determined by project dependencies.
 */
export async function applyDprintFormatterSettings(
  targetDir: string,
): Promise<{ addedLanguages: string[]; disabledPrettier: boolean }> {
  const languages = await getDprintLanguages(targetDir);
  return addLanguageFormatterSettings(targetDir, languages, DPRINT_VSCODE_EXTENSIONS[0]);
}

/**
 * Apply dprint-specific VSCode settings (experimentalLsp, verbose).
 */
export async function applyDprintVSCodeSettings(
  targetDir: string,
): Promise<boolean> {
  const settings = await readSettingsJson(targetDir);
  let modified = false;

  if (settings['dprint.experimentalLsp'] !== true) {
    settings['dprint.experimentalLsp'] = true;
    modified = true;
  }
  if (settings['dprint.verbose'] !== true) {
    settings['dprint.verbose'] = true;
    modified = true;
  }

  if (modified) {
    await writeSettingsJson(targetDir, settings);
  }

  return modified;
}
