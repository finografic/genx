/**
 * CSS feature VSCode configuration utilities — oxfmt formatters + **removal** of legacy Stylelint
 * keys/extensions.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  addLanguageFormatterSettings,
  ensureMarkdownlintConfigAndStylesAtEnd,
  ensureVSCodeDir,
  fileExists,
  parseJsoncObject,
  removeRootPropertyJsonc,
  setRootPropertyJsonc,
} from 'utils';

import { setLanguageFormatterBlock } from 'utils/vscode-jsonc.utils';

import type { VSCodeExtensionsJson } from 'types/vscode.types';

import { CSS_OXFMT_LANGUAGES, CSS_VSCODE_EXTENSIONS } from './css.constants';

// DEPRECATED: Legacy Stylelint VS Code keys — stripped from settings.json during migration only; remove when
// Stylelint migration is dropped (no firm date).
const LEGACY_STYLELINT_ROOT_KEYS = ['stylelint.enable', 'stylelint.validate'] as const;
const LEGACY_VALIDATE_KEYS_WHEN_FALSE = ['css.validate', 'scss.validate'] as const;

/**
 * Remove Stylelint-related root keys and `css.validate` / `scss.validate` when set to `false` (undo
 * stylelint-era disables). Pure text transform for preview.
 */
export function proposeStripLegacyStylelintFromVSCodeSettings(text: string): string {
  let t = text;
  for (const key of LEGACY_STYLELINT_ROOT_KEYS) {
    if ((parseJsoncObject(t) as Record<string, unknown>)[key] !== undefined) {
      t = removeRootPropertyJsonc(t, key);
    }
  }
  let root = parseJsoncObject(t) as Record<string, unknown>;
  for (const key of LEGACY_VALIDATE_KEYS_WHEN_FALSE) {
    if (root[key] === false) {
      t = removeRootPropertyJsonc(t, key);
      root = parseJsoncObject(t) as Record<string, unknown>;
    }
  }
  const tail = ensureMarkdownlintConfigAndStylesAtEnd(t);
  return tail.changed ? tail.text : t;
}

/**
 * DEPRECATED: Legacy apply path — strips Stylelint keys like preview; prefer `previewCss` + apply preview.
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

  const next = proposeStripLegacyStylelintFromVSCodeSettings(text);
  if (next === text) {
    return false;
  }
  await writeFile(filePath, next.endsWith('\n') ? next : `${next}\n`, 'utf8');
  return true;
}

/**
 * Configure oxfmt (oxc) as the default formatter for CSS/SCSS in `.vscode/settings.json`.
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

/** Strip legacy Stylelint VS Code keys, then apply oxfmt formatter blocks (same order as `previewCss`). */
export function proposeCssCombinedSettingsText(startText: string): {
  text: string;
  addedLanguages: string[];
} {
  const stripped = proposeStripLegacyStylelintFromVSCodeSettings(startText);
  return proposeCssOxfmtFormatterText(stripped);
}

const BASE_EXTENSIONS_TEXT = `${JSON.stringify(
  { recommendations: [], unwantedRecommendations: [] } satisfies VSCodeExtensionsJson,
  null,
  2,
)}\n`;

/**
 * Remove `stylelint.vscode-stylelint` from recommendations when present (migration). Pure (for preview).
 */
export function proposeCssExtensionsJsonText(currentRaw: string | undefined): {
  proposed: string;
  changed: boolean;
} {
  const parsed = (
    currentRaw ? parseJsoncObject(currentRaw) : { recommendations: [], unwantedRecommendations: [] }
  ) as VSCodeExtensionsJson;
  const strip = new Set<string>(CSS_VSCODE_EXTENSIONS);
  const before = [...(parsed.recommendations ?? [])];
  const recommendations = before.filter((id) => !strip.has(id));
  const proposedObj: VSCodeExtensionsJson = { ...parsed, recommendations };
  const proposed = `${JSON.stringify(proposedObj, null, 2)}\n`;
  const baseline = currentRaw ?? BASE_EXTENSIONS_TEXT;
  const changed = proposed !== baseline;
  return { proposed, changed };
}

/**
 * DEPRECATED: Was used to add Stylelint extension; use `proposeCssExtensionsJsonText` + apply preview
 * instead.
 */
export async function applyCssExtensions(targetDir: string): Promise<string[]> {
  const extPath = resolve(targetDir, '.vscode', 'extensions.json');
  const currentRaw = fileExists(extPath) ? await readFile(extPath, 'utf8') : undefined;
  const { proposed, changed } = proposeCssExtensionsJsonText(currentRaw);
  if (!changed) {
    return [];
  }
  await ensureVSCodeDir(targetDir);
  await writeFile(extPath, proposed, 'utf8');
  return [...CSS_VSCODE_EXTENSIONS];
}
