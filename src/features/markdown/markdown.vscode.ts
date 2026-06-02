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
  collectVSCodeLanguageOrder,
  ensureVSCodeDir,
  fileExists,
  insertLanguagesBefore,
  jsonLikeTextsEquivalent,
  parseJsoncObject,
  readExtensionsJson,
  renderGroupedVSCodeSettingsJson,
  VSCODE_BASE_LANGUAGE_ORDER,
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

  const settings = current ? parseJsoncObject(current) : { ...BASE_SETTINGS_JSON };
  delete settings[MARKDOWNLINT_CONFIG_KEY];

  const currentStyles = settings[MARKDOWN_STYLES_KEY] as string[] | undefined;
  const newPath = MARKDOWN_VSCODE_SETTINGS[MARKDOWN_STYLES_KEY][0];

  if (!currentStyles) {
    settings[MARKDOWN_STYLES_KEY] = [...MARKDOWN_VSCODE_SETTINGS[MARKDOWN_STYLES_KEY]];
  } else if (currentStyles.includes(MARKDOWN_STYLES_LEGACY_PATH)) {
    settings[MARKDOWN_STYLES_KEY] = currentStyles.map((stylePath) =>
      stylePath === MARKDOWN_STYLES_LEGACY_PATH ? newPath : stylePath,
    );
  }

  const existingOrder = collectVSCodeLanguageOrder(settings);
  const languageOrder =
    existingOrder.length > 0
      ? insertLanguagesBefore(existingOrder, ['markdown'], 'markdown')
      : [...VSCODE_BASE_LANGUAGE_ORDER];

  const proposed = renderGroupedVSCodeSettingsJson(settings, { languageOrder });

  return { path: filePath, current, proposed };
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
