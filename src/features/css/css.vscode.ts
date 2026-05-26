/**
 * CSS feature VSCode configuration utilities.
 */

import {
  addLanguageFormatterSettings,
  ensureMarkdownlintConfigAndStylesAtEnd,
  parseJsoncObject,
} from 'utils';

import { setLanguageFormatterBlock } from 'utils/vscode-jsonc.utils';

import type { VSCodeExtensionsJson } from 'types/vscode.types';

import { CSS_OXFMT_LANGUAGES } from './css.constants';

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
 * Oxfmt as CSS/SCSS default formatter — mirrors `addLanguageFormatterSettings` without I/O.
 */
export function proposeCssOxfmtFormatterText(text: string): { text: string; addedLanguages: string[] } {
  const addedLanguages: string[] = [];
  let t = text;

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

/** Set oxfmt formatter blocks for CSS/SCSS. */
export function proposeCssCombinedSettingsText(startText: string): {
  text: string;
  addedLanguages: string[];
} {
  return proposeCssOxfmtFormatterText(startText);
}

const BASE_EXTENSIONS_TEXT = `${JSON.stringify({ recommendations: [] } satisfies VSCodeExtensionsJson, null, 2)}\n`;

/**
 * Propose extensions.json content — pure (for preview).
 */
export function proposeCssExtensionsJsonText(currentRaw: string | undefined): {
  proposed: string;
  added: string[];
} {
  const parsed = (
    currentRaw ? parseJsoncObject(currentRaw) : { recommendations: [] }
  ) as VSCodeExtensionsJson;

  const { unwantedRecommendations: _removed, ...rest } = parsed;
  const recommendations = rest.recommendations ?? [];

  const proposedObj: VSCodeExtensionsJson = { ...rest, recommendations };
  const proposed = `${JSON.stringify(proposedObj, null, 2)}\n`;
  const baseline = currentRaw ?? BASE_EXTENSIONS_TEXT;

  if (proposed === baseline) {
    return { proposed, added: [] };
  }
  return { proposed, added: [] };
}
