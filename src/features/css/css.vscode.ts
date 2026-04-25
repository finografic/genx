/**
 * CSS feature VSCode configuration utilities.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  addLanguageFormatterSettings,
  ensureVSCodeDir,
  fileExists,
  ensureMarkdownlintConfigAndStylesAtEnd,
  parseJsoncObject,
} from 'utils';

import { removeRootKeysWithPrefix, setLanguageFormatterBlock } from 'utils/vscode-jsonc.utils';

import type { VSCodeExtensionsJson } from 'types/vscode.types';

import { CSS_OXFMT_LANGUAGES, CSS_VSCODE_STYLELINT_EXT } from './css.constants';

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

// DEPRECATED: stylelint VSCode settings removed — kept to strip them when migrating.
function removeStylelintSettings(text: string): string {
  const result = removeRootKeysWithPrefix(text, 'stylelint.');
  return result.text;
}

/**
 * Oxfmt as CSS/SCSS default formatter — mirrors `addLanguageFormatterSettings` without I/O. Also removes
 * legacy stylelint settings if present.
 */
export function proposeCssOxfmtFormatterText(text: string): { text: string; addedLanguages: string[] } {
  const addedLanguages: string[] = [];
  // DEPRECATED: remove any lingering stylelint.* settings
  let t = removeStylelintSettings(text);

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

/** Remove stylelint settings then set oxfmt formatter blocks (migration-safe). */
export function proposeCssCombinedSettingsText(startText: string): {
  text: string;
  addedLanguages: string[];
} {
  return proposeCssOxfmtFormatterText(startText);
}

const BASE_EXTENSIONS_TEXT = `${JSON.stringify({ recommendations: [] } satisfies VSCodeExtensionsJson, null, 2)}\n`;

/**
 * Remove stylelint extension from recommendations — pure (for preview).
 */
export function proposeCssExtensionsJsonText(currentRaw: string | undefined): {
  proposed: string;
  added: string[];
} {
  const parsed = (
    currentRaw ? parseJsoncObject(currentRaw) : { recommendations: [] }
  ) as VSCodeExtensionsJson;

  // Remove stylelint from recommendations. DEPRECATED: unwantedRecommendations — remove if present.
  const { unwantedRecommendations: _removed, ...rest } = parsed;
  const recommendations = (rest.recommendations ?? []).filter((id) => id !== CSS_VSCODE_STYLELINT_EXT);

  const proposedObj: VSCodeExtensionsJson = { ...rest, recommendations };
  const proposed = `${JSON.stringify(proposedObj, null, 2)}\n`;
  const baseline = currentRaw ?? BASE_EXTENSIONS_TEXT;

  if (proposed === baseline) {
    return { proposed, added: [] };
  }
  return { proposed, added: [CSS_VSCODE_STYLELINT_EXT] };
}

// DEPRECATED: stylelint extension application removed — use proposeCssOxfmtFormatterText.
export async function applyCssVSCodeSettings(targetDir: string): Promise<boolean> {
  const filePath = resolve(targetDir, '.vscode', 'settings.json');
  await ensureVSCodeDir(targetDir);
  if (!fileExists(filePath)) return false;

  const text = await readFile(filePath, 'utf8');
  const removed = removeStylelintSettings(text);
  if (removed === text) return false;
  await writeFile(filePath, removed, 'utf8');
  return true;
}
