/**
 * CSS feature VSCode configuration utilities.
 */

import {
  addExtensionRecommendations,
  addLanguageFormatterSettings,
  readSettingsJson,
  writeSettingsJson,
} from 'utils';
import { CSS_DPRINT_LANGUAGES, CSS_VSCODE_EXTENSIONS, CSS_VSCODE_SETTINGS } from './css.constants';

/**
 * Add stylelint extension recommendation to .vscode/extensions.json.
 */
export async function applyCssExtensions(targetDir: string): Promise<string[]> {
  return addExtensionRecommendations(targetDir, [...CSS_VSCODE_EXTENSIONS]);
}

/**
 * Add stylelint settings to .vscode/settings.json.
 */
export async function applyCssVSCodeSettings(targetDir: string): Promise<boolean> {
  const settings = await readSettingsJson(targetDir);
  let modified = false;

  if (settings['stylelint.enable'] !== true) {
    settings['stylelint.enable'] = true;
    modified = true;
  }

  if (!settings['stylelint.validate']) {
    settings['stylelint.validate'] = [...CSS_VSCODE_SETTINGS['stylelint.validate']];
    modified = true;
  }

  if (settings['css.validate'] !== false) {
    settings['css.validate'] = false;
    modified = true;
  }

  if (settings['scss.validate'] !== false) {
    settings['scss.validate'] = false;
    modified = true;
  }

  if (modified) {
    await writeSettingsJson(targetDir, settings);
  }

  return modified;
}

/**
 * Configure dprint as the default formatter for CSS/SCSS in .vscode/settings.json.
 */
export async function applyCssDprintSettings(targetDir: string): Promise<string[]> {
  const { addedLanguages } = await addLanguageFormatterSettings(
    targetDir,
    [...CSS_DPRINT_LANGUAGES],
    'dprint.dprint',
  );
  return addedLanguages;
}
