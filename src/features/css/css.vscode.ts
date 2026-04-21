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

import { setLanguageFormatterBlock } from 'utils/vscode-jsonc.utils';

import type { VSCodeExtensionsJson } from 'types/vscode.types';

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

/**
 * Stylelint-related VS Code settings — pure text transform (for preview).
 */
export function proposeCssVSCodeSettingsText(text: string): string {
  let t = text;

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

  const tail = ensureMarkdownlintConfigAndStylesAtEnd(t);
  return tail.changed ? tail.text : t;
}

/**
 * Oxfmt as CSS/SCSS default formatter — mirrors `addLanguageFormatterSettings` without I/O.
 */
export function proposeCssOxfmtFormatterText(text: string): { text: string; addedLanguages: string[] } {
  const addedLanguages: string[] = [];
  let t = text;

  const root0 = parseJsoncObject(t) as Record<string, unknown>;
  if (root0['prettier.enable'] !== false) {
    t = setRootPropertyJsonc(t, 'prettier.enable', false);
  }

  for (const lang of CSS_OXFMT_LANGUAGES) {
    const r = setLanguageFormatterBlock(t, lang, 'oxc.oxc-vscode');
    if (r.changed) {
      t = r.text;
      addedLanguages.push(lang);
    }
  }

  const tail = ensureMarkdownlintConfigAndStylesAtEnd(t);
  if (tail.changed) {
    t = tail.text;
  }

  return { text: t, addedLanguages };
}

/** Apply stylelint settings then oxfmt formatter blocks (same order as `applyCss`). */
export function proposeCssCombinedSettingsText(startText: string): {
  text: string;
  addedLanguages: string[];
} {
  const afterStylelint = proposeCssVSCodeSettingsText(startText);
  return proposeCssOxfmtFormatterText(afterStylelint);
}

const BASE_EXTENSIONS_TEXT = `${JSON.stringify(
  { recommendations: [], unwantedRecommendations: [] } satisfies VSCodeExtensionsJson,
  null,
  2,
)}\n`;

/**
 * Merge extension recommendations — pure (for preview).
 */
export function proposeCssExtensionsJsonText(currentRaw: string | undefined): {
  proposed: string;
  added: string[];
} {
  const parsed = (
    currentRaw ? parseJsoncObject(currentRaw) : { recommendations: [], unwantedRecommendations: [] }
  ) as VSCodeExtensionsJson;
  const recommendations = [...(parsed.recommendations ?? [])];
  const added: string[] = [];
  for (const ext of CSS_VSCODE_EXTENSIONS) {
    if (!recommendations.includes(ext)) {
      recommendations.push(ext);
      added.push(ext);
    }
  }
  const proposedObj: VSCodeExtensionsJson = { ...parsed, recommendations };
  const proposed = `${JSON.stringify(proposedObj, null, 2)}\n`;
  const baseline = currentRaw ?? BASE_EXTENSIONS_TEXT;
  if (proposed === baseline) {
    return { proposed, added: [] };
  }
  return { proposed, added };
}
