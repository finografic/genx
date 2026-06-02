/**
 * CSS feature VSCode configuration utilities.
 */

import {
  addLanguageFormatterSettings,
  collectVSCodeLanguageOrder,
  parseJsoncObject,
  renderGroupedVSCodeSettingsJson,
  VSCODE_BASE_LANGUAGE_ORDER,
} from 'utils';

import { insertLanguagesBefore, languageBlockKey } from 'utils/vscode-settings.groups.js';

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
  const settings = parseJsoncObject(text);

  for (const lang of CSS_OXFMT_LANGUAGES) {
    const blockKey = languageBlockKey(lang);
    const existingBlock = settings[blockKey];
    const baseBlock: Record<string, unknown> =
      existingBlock && typeof existingBlock === 'object' && !Array.isArray(existingBlock)
        ? { ...existingBlock }
        : {};

    if (
      !existingBlock ||
      typeof existingBlock !== 'object' ||
      Array.isArray(existingBlock) ||
      baseBlock['editor.defaultFormatter'] !== 'oxc.oxc-vscode'
    ) {
      addedLanguages.push(lang);
    }

    settings[blockKey] = {
      ...baseBlock,
      'editor.defaultFormatter': 'oxc.oxc-vscode',
    };
  }

  const existingOrder = collectVSCodeLanguageOrder(settings);
  const languageOrder =
    existingOrder.length > 0
      ? insertLanguagesBefore(existingOrder, [...CSS_OXFMT_LANGUAGES], 'markdown')
      : insertLanguagesBefore([...VSCODE_BASE_LANGUAGE_ORDER], [...CSS_OXFMT_LANGUAGES], 'markdown');

  return { text: renderGroupedVSCodeSettingsJson(settings, { languageOrder }), addedLanguages };
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
