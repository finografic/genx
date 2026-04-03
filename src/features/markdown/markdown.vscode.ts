/**
 * Markdown VSCode configuration utilities.
 *
 * Handles VSCode settings (markdownlint config, preview styles)
 * and markdown CSS file copying.
 */

import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addExtensionRecommendations, fileExists, readSettingsJson, writeSettingsJson } from 'utils';

import {
  MARKDOWN_STYLES_KEY,
  MARKDOWN_VSCODE_SETTINGS,
  MARKDOWNLINT_CONFIG_KEY,
  MARKDOWNLINT_VSCODE_EXTENSIONS,
} from './markdown.constants';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** CSS files to copy from _templates/.vscode to target .vscode */
const MARKDOWN_CSS_FILES = ['markdown-custom-dark.css', 'markdown-github-light.css'] as const;

/**
 * Add markdownlint extension recommendations to .vscode/extensions.json.
 * Returns the list of extensions that were actually added.
 */
export async function applyMarkdownExtensions(targetDir: string): Promise<string[]> {
  return addExtensionRecommendations(targetDir, [...MARKDOWNLINT_VSCODE_EXTENSIONS]);
}

/**
 * Add markdown settings to VSCode settings.json.
 * Only adds markdownlint.config and markdown.styles (no [markdown] / oxc.oxc-vscode).
 */
export async function applyMarkdownVSCodeSettings(targetDir: string): Promise<boolean> {
  const settings = await readSettingsJson(targetDir);
  let modified = false;

  if (!settings[MARKDOWNLINT_CONFIG_KEY]) {
    settings[MARKDOWNLINT_CONFIG_KEY] = MARKDOWN_VSCODE_SETTINGS[MARKDOWNLINT_CONFIG_KEY];
    modified = true;
  }

  if (!settings[MARKDOWN_STYLES_KEY]) {
    settings[MARKDOWN_STYLES_KEY] = [...MARKDOWN_VSCODE_SETTINGS[MARKDOWN_STYLES_KEY]];
    modified = true;
  }

  if (modified) {
    await writeSettingsJson(targetDir, settings);
  }

  return modified;
}

/**
 * Copy one CSS file from _templates/.vscode to target .vscode folder.
 */
async function copyMarkdownCssFile(
  targetDir: string,
  filename: (typeof MARKDOWN_CSS_FILES)[number],
): Promise<boolean> {
  const destPath = resolve(targetDir, '.vscode', filename);
  if (fileExists(destPath)) {
    return false;
  }

  const templatesPath = resolve(__dirname, '../../../../_templates/.vscode', filename);
  const distTemplatesPath = resolve(__dirname, '../../../_templates/.vscode', filename);

  const srcPath = fileExists(templatesPath)
    ? templatesPath
    : fileExists(distTemplatesPath)
      ? distTemplatesPath
      : null;
  if (!srcPath) {
    return false;
  }

  await mkdir(dirname(destPath), { recursive: true });
  await copyFile(srcPath, destPath);
  return true;
}

/**
 * Copy markdown CSS files (markdown-custom-dark.css, markdown-github-light.css) to target .vscode folder.
 */
export async function copyMarkdownCss(targetDir: string): Promise<boolean> {
  let anyCopied = false;
  for (const filename of MARKDOWN_CSS_FILES) {
    const copied = await copyMarkdownCssFile(targetDir, filename);
    if (copied) anyCopied = true;
  }
  return anyCopied;
}
