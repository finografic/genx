/**
 * CSS feature VSCode configuration utilities.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  addExtensionRecommendations,
  addLanguageFormatterSettings,
  ensureVSCodeDir,
  fileExists,
  ensureMarkdownlintConfigAndStylesAtEnd,
  parseJsoncObject,
  setRootPropertyJsonc,
} from 'utils';

import { CSS_OXFMT_LANGUAGES, CSS_VSCODE_EXTENSIONS, CSS_VSCODE_SETTINGS } from './css.constants';

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
  const filePath = resolve(targetDir, '.vscode', 'settings.json');
  await ensureVSCodeDir(targetDir);

  let text: string;
  if (!fileExists(filePath)) {
    text = '{}\n';
    await writeFile(filePath, text, 'utf8');
  } else {
    text = await readFile(filePath, 'utf8');
  }

  let t = text;
  const before = t;

  if ((parseJsoncObject(t) as Record<string, unknown>)['stylelint.enable'] !== true) {
    t = setRootPropertyJsonc(t, 'stylelint.enable', true);
  }

  if (!(parseJsoncObject(t) as Record<string, unknown>)['stylelint.validate']) {
    t = setRootPropertyJsonc(t, 'stylelint.validate', [...CSS_VSCODE_SETTINGS['stylelint.validate']]);
  }

  if ((parseJsoncObject(t) as Record<string, unknown>)['css.validate'] !== false) {
    t = setRootPropertyJsonc(t, 'css.validate', false);
  }

  if ((parseJsoncObject(t) as Record<string, unknown>)['scss.validate'] !== false) {
    t = setRootPropertyJsonc(t, 'scss.validate', false);
  }

  let changed = t !== before;
  const tail = ensureMarkdownlintConfigAndStylesAtEnd(t);
  if (tail.changed) {
    t = tail.text;
    changed = true;
  }
  if (changed) {
    await writeFile(filePath, t, 'utf8');
  }

  return changed;
}

/**
 * Configure oxfmt (oxc) as the default formatter for CSS/SCSS in .vscode/settings.json.
 */
export async function applyCssOxfmtSettings(targetDir: string): Promise<string[]> {
  const { addedLanguages } = await addLanguageFormatterSettings(
    targetDir,
    [...CSS_OXFMT_LANGUAGES],
    'oxc.oxc-vscode',
  );
  return addedLanguages;
}
