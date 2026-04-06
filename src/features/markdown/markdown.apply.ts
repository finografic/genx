import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  fileExists,
  installDevDependency,
  isDependencyDeclared,
  spinner,
  successMessage,
  successUpdatedMessage,
} from 'utils';
import type { FeatureApplyResult, FeatureContext } from '../feature.types';

import { ESLINT_CONFIG_FILES, PACKAGE_JSON } from 'config/constants.config';
import type { PackageJson } from 'types/package-json.types';
import { OXFMT_LINT_STAGED_DATA_PATTERN_ALIASES } from '../oxfmt/oxfmt.constants';
import {
  ESLINT_MARKDOWN_CONFIG_BLOCK,
  ESLINT_MARKDOWN_IMPORTS,
  LINT_STAGED_DATA_ONLY_PATTERN,
  LINT_STAGED_MD_PATTERN,
  LINT_STAGED_OXFMT_CMD,
  MARKDOWNLINT_PACKAGE,
  MARKDOWNLINT_PACKAGE_VERSION,
} from './markdown.constants';
import { applyMarkdownExtensions, applyMarkdownVSCodeSettings, copyMarkdownCss } from './markdown.vscode';

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
      updatedContent =
        updatedContent.slice(0, insertPos) + '\n' + ESLINT_MARKDOWN_IMPORTS + updatedContent.slice(insertPos);
    }
  }

  // Insert before `]);` that closes `defineConfig([` (preferred) or legacy `];` + `export default config`
  const modernEnd = /\n\]\);\s*$/;
  const legacyEnd = /\n\];\s*\n+export default\s+config\b/m;

  let insertPos: number | null = null;
  const modernMatch = modernEnd.exec(updatedContent);
  if (modernMatch) {
    insertPos = modernMatch.index;
  } else {
    const legacyMatch = legacyEnd.exec(updatedContent);
    if (legacyMatch) {
      insertPos = legacyMatch.index;
    } else {
      const configArrayEndRegex = /\n\];?\s*\n*export default/;
      const configEndMatch = configArrayEndRegex.exec(updatedContent);
      if (configEndMatch) {
        insertPos = configEndMatch.index;
      }
    }
  }

  if (insertPos !== null) {
    updatedContent =
      updatedContent.slice(0, insertPos) +
      '\n' +
      ESLINT_MARKDOWN_CONFIG_BLOCK +
      updatedContent.slice(insertPos);
  }

  if (updatedContent !== content) {
    await writeFile(eslintConfigPath, updatedContent, 'utf8');
    return true;
  }

  return false;
}

/**
 * Split legacy `*.{…,md}` lint-staged (oxfmt only on one glob) into a data glob without `md` and
 * `*.md` with oxfmt then `eslint --fix`.
 */
async function addMarkdownLintStaged(targetDir: string): Promise<boolean> {
  const packageJsonPath = resolve(targetDir, PACKAGE_JSON);
  const raw = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(raw) as PackageJson;
  const lintStaged = { ...(packageJson['lint-staged'] as Record<string, string[]> | undefined) };
  if (!lintStaged || Object.keys(lintStaged).length === 0) return false;

  const mdCommands = lintStaged[LINT_STAGED_MD_PATTERN];

  if (mdCommands?.some((c) => c.includes('oxfmt')) && mdCommands.includes('eslint --fix')) {
    return false;
  }

  if (mdCommands?.includes('eslint --fix') && !mdCommands.some((c) => c.includes('oxfmt'))) {
    lintStaged[LINT_STAGED_MD_PATTERN] = [LINT_STAGED_OXFMT_CMD, 'eslint --fix'];
    packageJson['lint-staged'] = lintStaged;
    await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
    return true;
  }

  if (mdCommands?.some((c) => c.includes('oxfmt')) && !mdCommands.some((c) => c.includes('eslint'))) {
    lintStaged[LINT_STAGED_MD_PATTERN] = [LINT_STAGED_OXFMT_CMD, 'eslint --fix'];
    packageJson['lint-staged'] = lintStaged;
    await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
    return true;
  }

  const combinedKey = [...OXFMT_LINT_STAGED_DATA_PATTERN_ALIASES].find(
    (k) => lintStaged[k] && Array.isArray(lintStaged[k]),
  );
  const combined = combinedKey ? (lintStaged[combinedKey] as string[]) : undefined;

  if (combined && combined.includes(LINT_STAGED_OXFMT_CMD) && !combined.some((c) => c.includes('eslint'))) {
    lintStaged[LINT_STAGED_DATA_ONLY_PATTERN] = [LINT_STAGED_OXFMT_CMD];
    if (combinedKey) delete lintStaged[combinedKey];
    lintStaged[LINT_STAGED_MD_PATTERN] = [LINT_STAGED_OXFMT_CMD, 'eslint --fix'];
    packageJson['lint-staged'] = lintStaged;
    await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
    return true;
  }

  const dataOnly = lintStaged[LINT_STAGED_DATA_ONLY_PATTERN];
  if (dataOnly && !lintStaged[LINT_STAGED_MD_PATTERN]) {
    lintStaged[LINT_STAGED_MD_PATTERN] = [LINT_STAGED_OXFMT_CMD, 'eslint --fix'];
    packageJson['lint-staged'] = lintStaged;
    await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
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

  // 6. lint-staged: add eslint --fix for *.md when using merged data+md glob (base template)
  const lintStagedModified = await addMarkdownLintStaged(context.targetDir);
  if (lintStagedModified) {
    applied.push('lint-staged (*.md eslint --fix)');
    successUpdatedMessage('Updated lint-staged for markdown + ESLint');
  }

  if (applied.length === 0) {
    return { applied, noopMessage: 'Markdown linting already configured. No changes made.' };
  }

  return { applied };
}
