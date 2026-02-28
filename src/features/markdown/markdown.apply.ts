import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  fileExists,
  installDevDependency,
  isDependencyDeclared,
  spinner,
  successMessage,
} from 'utils';
import { ESLINT_CONFIG_FILES } from 'config/constants.config';
import type { FeatureApplyResult, FeatureContext } from '../feature.types';
import {
  ESLINT_MARKDOWN_CONFIG_BLOCK,
  ESLINT_MARKDOWN_IMPORTS,
  MARKDOWNLINT_PACKAGE,
  MARKDOWNLINT_PACKAGE_VERSION,
} from './markdown.constants';
import {
  applyMarkdownExtensions,
  applyMarkdownVSCodeSettings,
  copyMarkdownCss,
} from './markdown.vscode';

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
  if (content.includes(MARKDOWNLINT_PACKAGE) || content.includes("files: ['**/*.md']")) {
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
  const settingsModified = await applyMarkdownVSCodeSettings(context.targetDir);
  if (settingsModified) {
    applied.push('.vscode/settings.json (markdown)');
    successMessage('Added markdown settings to VSCode');
  }

  // 4. Add markdownlint extension recommendation
  const addedExtensions = await applyMarkdownExtensions(context.targetDir);
  if (addedExtensions.length > 0) {
    applied.push('.vscode/extensions.json');
    successMessage(`Added extension recommendation: ${addedExtensions.join(', ')}`);
  }

  // 5. Copy markdown CSS files from _templates/.vscode
  const cssCopied = await copyMarkdownCss(context.targetDir);
  if (cssCopied) {
    applied.push('.vscode/markdown CSS files');
    successMessage('Copied markdown CSS files to .vscode');
  }

  if (applied.length === 0) {
    return { applied, noopMessage: 'Markdown linting already configured. No changes made.' };
  }

  return { applied };
}
