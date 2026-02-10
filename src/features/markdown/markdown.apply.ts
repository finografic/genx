import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  addExtensionRecommendations,
  fileExists,
  installDevDependency,
  isDependencyDeclared,
  readSettingsJson,
  spinner,
  successMessage,
  writeSettingsJson,
} from 'utils';
import { ESLINT_CONFIG_FILES } from 'config/constants.config';
import type { FeatureApplyResult, FeatureContext } from '../feature.types';
import {
  ESLINT_MARKDOWN_CONFIG_BLOCK,
  ESLINT_MARKDOWN_IMPORTS,
  MARKDOWN_STYLES_KEY,
  MARKDOWN_VSCODE_SETTINGS,
  MARKDOWNLINT_CONFIG_KEY,
  MARKDOWNLINT_PACKAGE,
  MARKDOWNLINT_PACKAGE_VERSION,
  MARKDOWNLINT_VSCODE_EXTENSION,
} from './markdown.constants';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Find the eslint config file in the target directory.
 */
function findEslintConfig(targetDir: string): string | null {
  for (const candidate of ESLINT_CONFIG_FILES) {
    const filePath = resolve(targetDir, candidate);
    if (fileExists(filePath)) {
      return filePath;
    }
  }

  return null;
}

/**
 * Add markdown config block to eslint config file.
 */
async function addMarkdownToEslintConfig(eslintConfigPath: string): Promise<boolean> {
  const content = await readFile(eslintConfigPath, 'utf8');

  // Check if markdown config already exists
  if (content.includes(MARKDOWNLINT_PACKAGE) || content.includes('files: [\'**/*.md\']')) {
    return false;
  }

  let updatedContent = content;

  // Add imports if not present
  if (!content.includes(MARKDOWNLINT_PACKAGE)) {
    // Find the last import statement and add after it
    const importRegex = /^import .+ from ['"].+['"];?\s*$/gm;
    let lastImportMatch: RegExpExecArray | null = null;
    let match: RegExpExecArray | null;

    while ((match = importRegex.exec(content)) !== null) {
      lastImportMatch = match;
    }

    if (lastImportMatch) {
      const insertPos = lastImportMatch.index + lastImportMatch[0].length;
      updatedContent = updatedContent.slice(0, insertPos)
        + '\n' + ESLINT_MARKDOWN_IMPORTS
        + updatedContent.slice(insertPos);
    }
  }

  // Find the closing bracket of the config array and insert before it
  // Look for the pattern `];` or `]` at the end
  const configArrayEndRegex = /\n\];?\s*\n*export default/;
  const configEndMatch = configArrayEndRegex.exec(updatedContent);

  if (configEndMatch) {
    const insertPos = configEndMatch.index;
    updatedContent = updatedContent.slice(0, insertPos)
      + '\n' + ESLINT_MARKDOWN_CONFIG_BLOCK
      + updatedContent.slice(insertPos);
  } else {
    // Try another pattern - just before `export default config`
    const altRegex = /\n\];\n\nexport default/;
    const altMatch = altRegex.exec(updatedContent);
    if (altMatch) {
      const insertPos = altMatch.index + 2; // After the newline, before ];
      updatedContent = updatedContent.slice(0, insertPos)
        + ESLINT_MARKDOWN_CONFIG_BLOCK + '\n'
        + updatedContent.slice(insertPos);
    }
  }

  if (updatedContent !== content) {
    await writeFile(eslintConfigPath, updatedContent, 'utf8');
    return true;
  }

  return false;
}

/**
 * Add markdown settings to VSCode settings.json.
 * Only adds markdownlint.config and markdown.styles (no [markdown] / dprint.dprint).
 */
async function addMarkdownVSCodeSettings(targetDir: string): Promise<boolean> {
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

/** CSS files to copy from templates/package/.vscode to target .vscode */
const MARKDOWN_CSS_FILES = ['markdown-custom.css', 'markdown-github-light.css'] as const;

/**
 * Copy one CSS file from templates/package/.vscode to target .vscode folder.
 */
async function copyMarkdownCssFile(
  targetDir: string,
  filename: (typeof MARKDOWN_CSS_FILES)[number],
): Promise<boolean> {
  const destPath = resolve(targetDir, '.vscode', filename);
  if (fileExists(destPath)) {
    return false;
  }

  const templatesPath = resolve(__dirname, '../../../../templates/package/.vscode', filename);
  const distTemplatesPath = resolve(__dirname, '../../../templates/package/.vscode', filename);

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
 * Copy markdown CSS files (markdown-custom.css, markdown-github-light.css) to target .vscode folder.
 */
async function copyMarkdownCss(targetDir: string): Promise<boolean> {
  let anyCopied = false;
  for (const filename of MARKDOWN_CSS_FILES) {
    const copied = await copyMarkdownCssFile(targetDir, filename);
    if (copied) anyCopied = true;
  }
  return anyCopied;
}

/**
 * Apply markdown feature to an existing package.
 */
export async function applyMarkdown(context: FeatureContext): Promise<FeatureApplyResult> {
  const applied: string[] = [];

  // 1. Install eslint-plugin-markdownlint
  const alreadyDeclared = await isDependencyDeclared(context.targetDir, MARKDOWNLINT_PACKAGE);
  if (!alreadyDeclared) {
    const installSpin = spinner();
    installSpin.start(`Installing ${MARKDOWNLINT_PACKAGE}...`);
    const installResult = await installDevDependency(
      context.targetDir,
      MARKDOWNLINT_PACKAGE,
      MARKDOWNLINT_PACKAGE_VERSION,
    );
    installSpin.stop(
      installResult.installed
        ? `Installed ${MARKDOWNLINT_PACKAGE}`
        : `${MARKDOWNLINT_PACKAGE} already installed`,
    );
    if (installResult.installed) {
      applied.push(MARKDOWNLINT_PACKAGE);
    }
  }

  // 2. Add markdown block to eslint.config.ts
  const eslintConfigPath = findEslintConfig(context.targetDir);
  if (eslintConfigPath) {
    const eslintModified = await addMarkdownToEslintConfig(eslintConfigPath);
    if (eslintModified) {
      applied.push('eslint.config.ts (markdown block)');
      successMessage('Added markdown linting to ESLint config');
    }
  }

  // 3. Add VSCode settings for markdown
  const settingsModified = await addMarkdownVSCodeSettings(context.targetDir);
  if (settingsModified) {
    applied.push('.vscode/settings.json (markdown)');
    successMessage('Added markdown settings to VSCode');
  }

  // 4. Add markdownlint extension recommendation
  const addedExtensions = await addExtensionRecommendations(context.targetDir, [
    MARKDOWNLINT_VSCODE_EXTENSION,
  ]);
  if (addedExtensions.length > 0) {
    applied.push('.vscode/extensions.json');
    successMessage(`Added extension recommendation: ${MARKDOWNLINT_VSCODE_EXTENSION}`);
  }

  // 5. Copy markdown CSS files from templates/package/.vscode
  const cssCopied = await copyMarkdownCss(context.targetDir);
  if (cssCopied) {
    applied.push('.vscode/markdown-custom.css, markdown-github-light.css');
    successMessage('Copied markdown CSS files to .vscode');
  }

  if (applied.length === 0) {
    return { applied, noopMessage: 'Markdown linting already configured. No changes made.' };
  }

  return { applied };
}
