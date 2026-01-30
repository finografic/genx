/**
 * dprint VSCode configuration utilities.
 *
 * Handles intelligent detection of which language categories should be
 * configured for dprint based on project dependencies.
 */

import { hasAnyDependency } from 'utils';
import {
  DPRINT_CATEGORY_DEPENDENCIES,
  DPRINT_LANGUAGE_CATEGORIES,
  DPRINT_VSCODE_EXTENSION,
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
 * Get the dprint extension ID.
 */
export function getDprintExtensionId(): string {
  return DPRINT_VSCODE_EXTENSION;
}
