/**
 * Markdown VSCode configuration utilities.
 *
 * Handles VSCode settings (preview styles + legacy inline markdownlint cleanup) and extension
 * recommendations.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  addExtensionRecommendations,
  BASE_SETTINGS_JSON,
  ensureMarkdownlintConfigAndStylesAtEnd,
  ensureVSCodeDir,
  fileExists,
  jsonLikeTextsEquivalent,
  parseJsoncObject,
  readExtensionsJson,
  removeRootPropertyJsonc,
  setRootPropertyJsonc,
} from 'utils';

import {
  MARKDOWN_STYLES_KEY,
  MARKDOWN_STYLES_LEGACY_PATH,
  MARKDOWN_VSCODE_SETTINGS,
  MARKDOWNLINT_CONFIG_KEY,
  MARKDOWNLINT_VSCODE_EXTENSIONS,
} from './markdown.constants';

const EXTENSIONS_JSON_PATH = ['.vscode', 'extensions.json'] as const;

/**
 * Proposed `.vscode/settings.json` text for the markdown feature (no disk writes).
 *
 * DEPRECATED migration path:
 * - remove legacy inline `markdownlint.config`
 * - migrate the old `.vscode/markdown-github-light.css` path to the md-lint package path
 */
export async function computeProposedMarkdownSettingsText(targetDir: string): Promise<{
  path: string;
  current: string;
  proposed: string;
}> {
  const filePath = resolve(targetDir, '.vscode', 'settings.json');
  let current = '';
  if (fileExists(filePath)) {
    current = await readFile(filePath, 'utf8');
  }

  let t = current || `${JSON.stringify({ ...BASE_SETTINGS_JSON }, null, 2)}\n`;
  const root = (): Record<string, unknown> => parseJsoncObject(t);

  if (root()[MARKDOWNLINT_CONFIG_KEY] !== undefined) {
    t = removeRootPropertyJsonc(t, MARKDOWNLINT_CONFIG_KEY);
  }

  const currentStyles = parseJsoncObject(t)[MARKDOWN_STYLES_KEY] as string[] | undefined;
  const newPath = MARKDOWN_VSCODE_SETTINGS[MARKDOWN_STYLES_KEY][0];

  if (!currentStyles) {
    t = setRootPropertyJsonc(t, MARKDOWN_STYLES_KEY, [...MARKDOWN_VSCODE_SETTINGS[MARKDOWN_STYLES_KEY]]);
  } else if (currentStyles.includes(MARKDOWN_STYLES_LEGACY_PATH)) {
    const migrated = currentStyles.map((s) => (s === MARKDOWN_STYLES_LEGACY_PATH ? newPath : s));
    t = setRootPropertyJsonc(t, MARKDOWN_STYLES_KEY, migrated);
  }

  const tail = ensureMarkdownlintConfigAndStylesAtEnd(t);
  if (tail.changed) {
    t = tail.text;
  }

  return { path: filePath, current, proposed: t };
}

/**
 * Proposed `.vscode/extensions.json` text for markdownlint recommendations (no disk writes).
 */
export async function computeProposedMarkdownExtensionsText(targetDir: string): Promise<{
  path: string;
  current: string;
  proposed: string;
}> {
  const filePath = resolve(targetDir, ...EXTENSIONS_JSON_PATH);
  let current = '';
  if (fileExists(filePath)) {
    current = await readFile(filePath, 'utf8');
  }

  const parsed = await readExtensionsJson(targetDir);
  const recommendations = [...(parsed.recommendations ?? [])];
  for (const ext of MARKDOWNLINT_VSCODE_EXTENSIONS) {
    if (!recommendations.includes(ext)) {
      recommendations.push(ext);
    }
  }
  const proposed = `${JSON.stringify({ ...parsed, recommendations }, null, 2)}\n`;
  return { path: filePath, current, proposed };
}

/**
 * Add markdownlint extension recommendations to .vscode/extensions.json. Returns the list of extensions that
 * were actually added.
 */
export async function applyMarkdownExtensions(targetDir: string): Promise<string[]> {
  return addExtensionRecommendations(targetDir, [...MARKDOWNLINT_VSCODE_EXTENSIONS]);
}

/**
 * Add markdown settings to VSCode settings.json. Only adds markdown.styles and removes legacy inline
 * markdownlint config (no [markdown] / oxc.oxc-vscode).
 */
export async function applyMarkdownVSCodeSettings(targetDir: string): Promise<boolean> {
  await ensureVSCodeDir(targetDir);
  const { path: filePath, current, proposed } = await computeProposedMarkdownSettingsText(targetDir);
  if (jsonLikeTextsEquivalent(proposed, current)) {
    return false;
  }
  await writeFile(filePath, proposed, 'utf8');
  return true;
}
