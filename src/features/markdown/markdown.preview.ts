import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileExists, isDependencyDeclared } from 'utils';
import type { FeaturePreviewResult } from '../../lib/feature-preview/feature-preview.types.js';
import type { FeatureContext } from '../feature.types';

import { ESLINT_CONFIG_FILES, PACKAGE_JSON } from 'config/constants.config';
import type { PackageJson } from 'types/package-json.types';
import { createWritePreviewChange } from '../../lib/feature-preview/feature-preview.utils.js';
import { OXFMT_LINT_STAGED_DATA_PATTERN_ALIASES } from '../oxfmt/oxfmt.constants.js';
import { packageJsonManifestDependencyFieldsChanged } from '../oxfmt/oxfmt.preview.js';
import {
  ESLINT_MARKDOWN_CONFIG_BLOCK,
  ESLINT_MARKDOWN_IMPORTS,
  LINT_STAGED_DATA_ONLY_PATTERN,
  LINT_STAGED_MD_PATTERN,
  LINT_STAGED_OXFMT_CMD,
  MARKDOWNLINT_PACKAGE,
  MARKDOWNLINT_PACKAGE_VERSION,
} from './markdown.constants';
import {
  computeProposedMarkdownExtensionsText,
  computeProposedMarkdownSettingsText,
  resolveMarkdownCssTemplatePath,
} from './markdown.vscode';

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
 * Returns proposed eslint config content when the markdown block should be added, else null.
 */
export function proposeMarkdownEslintContent(content: string): string | null {
  if (content.includes(MARKDOWNLINT_PACKAGE) || content.includes("files: ['**/*.md']")) {
    return null;
  }

  let updatedContent = content;

  if (!content.includes(MARKDOWNLINT_PACKAGE)) {
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

  if (insertPos === null) {
    return null;
  }

  updatedContent =
    updatedContent.slice(0, insertPos) +
    '\n' +
    ESLINT_MARKDOWN_CONFIG_BLOCK +
    updatedContent.slice(insertPos);

  if (updatedContent === content) {
    return null;
  }

  return updatedContent;
}

function formatPackageJsonString(packageJson: PackageJson): string {
  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

/**
 * Applies lint-staged markdown splits / `*.md` commands — same rules as `markdown.apply`.
 */
export function applyMarkdownLintStagedTransforms(packageJson: PackageJson): PackageJson {
  const lintStaged = { ...(packageJson['lint-staged'] as Record<string, string[]> | undefined) };
  if (!lintStaged || Object.keys(lintStaged).length === 0) {
    return packageJson;
  }

  const mdCommands = lintStaged[LINT_STAGED_MD_PATTERN];

  if (mdCommands?.some((c) => c.includes('oxfmt')) && mdCommands.includes('eslint --fix')) {
    return packageJson;
  }

  if (mdCommands?.includes('eslint --fix') && !mdCommands.some((c) => c.includes('oxfmt'))) {
    lintStaged[LINT_STAGED_MD_PATTERN] = [LINT_STAGED_OXFMT_CMD, 'eslint --fix'];
    return { ...packageJson, 'lint-staged': lintStaged };
  }

  if (mdCommands?.some((c) => c.includes('oxfmt')) && !mdCommands.some((c) => c.includes('eslint'))) {
    lintStaged[LINT_STAGED_MD_PATTERN] = [LINT_STAGED_OXFMT_CMD, 'eslint --fix'];
    return { ...packageJson, 'lint-staged': lintStaged };
  }

  const combinedKey = [...OXFMT_LINT_STAGED_DATA_PATTERN_ALIASES].find(
    (k) => lintStaged[k] && Array.isArray(lintStaged[k]),
  );
  const combined = combinedKey ? (lintStaged[combinedKey] as string[]) : undefined;

  if (combined && combined.includes(LINT_STAGED_OXFMT_CMD) && !combined.some((c) => c.includes('eslint'))) {
    lintStaged[LINT_STAGED_DATA_ONLY_PATTERN] = [LINT_STAGED_OXFMT_CMD];
    if (combinedKey) delete lintStaged[combinedKey];
    lintStaged[LINT_STAGED_MD_PATTERN] = [LINT_STAGED_OXFMT_CMD, 'eslint --fix'];
    return { ...packageJson, 'lint-staged': lintStaged };
  }

  const dataOnly = lintStaged[LINT_STAGED_DATA_ONLY_PATTERN];
  if (dataOnly && !lintStaged[LINT_STAGED_MD_PATTERN]) {
    lintStaged[LINT_STAGED_MD_PATTERN] = [LINT_STAGED_OXFMT_CMD, 'eslint --fix'];
    return { ...packageJson, 'lint-staged': lintStaged };
  }

  return packageJson;
}

function withMarkdownDevDependency(packageJson: PackageJson): PackageJson {
  const devDeps = packageJson.devDependencies as Record<string, string> | undefined;
  if (devDeps?.[MARKDOWNLINT_PACKAGE]) {
    return packageJson;
  }
  const devDependencies = {
    ...(packageJson.devDependencies ?? {}),
    [MARKDOWNLINT_PACKAGE]: MARKDOWNLINT_PACKAGE_VERSION,
  };
  return { ...packageJson, devDependencies };
}

/**
 * Preview markdown feature ownership: package.json, ESLint, VS Code, lint-staged, CSS assets.
 */
export async function previewMarkdown(context: FeatureContext): Promise<FeaturePreviewResult> {
  const { targetDir } = context;
  const changes: FeaturePreviewResult['changes'] = [];
  const applied: string[] = [];

  const packageJsonPath = resolve(targetDir, PACKAGE_JSON);
  const rawPkg = await readFile(packageJsonPath, 'utf8');
  let pkg = JSON.parse(rawPkg) as PackageJson;

  const hadDep = await isDependencyDeclared(targetDir, MARKDOWNLINT_PACKAGE);
  if (!hadDep) {
    pkg = withMarkdownDevDependency(pkg);
  }

  pkg = applyMarkdownLintStagedTransforms(pkg);

  const proposedPkgRaw = formatPackageJsonString(pkg);
  if (proposedPkgRaw !== rawPkg) {
    changes.push(
      createWritePreviewChange(
        packageJsonPath,
        rawPkg,
        proposedPkgRaw,
        'package.json (markdownlint, lint-staged)',
      ),
    );
  } else {
    applied.push('package.json (markdown manifest)');
  }

  const eslintPath = findEslintConfig(targetDir);
  if (eslintPath) {
    const eslintRaw = await readFile(eslintPath, 'utf8');
    const proposedEslint = proposeMarkdownEslintContent(eslintRaw);
    if (proposedEslint !== null) {
      const out = proposedEslint.endsWith('\n') ? proposedEslint : `${proposedEslint}\n`;
      changes.push(createWritePreviewChange(eslintPath, eslintRaw, out, 'eslint config (markdown block)'));
    } else {
      applied.push('eslint (markdown block present)');
    }
  }

  const settings = await computeProposedMarkdownSettingsText(targetDir);
  if (settings.proposed !== settings.current) {
    changes.push(
      createWritePreviewChange(
        settings.path,
        settings.current,
        settings.proposed,
        '.vscode/settings.json (markdownlint)',
      ),
    );
  } else {
    applied.push('.vscode/settings.json (markdown)');
  }

  const ext = await computeProposedMarkdownExtensionsText(targetDir);
  if (ext.proposed !== ext.current) {
    changes.push(
      createWritePreviewChange(ext.path, ext.current, ext.proposed, '.vscode/extensions.json (markdownlint)'),
    );
  } else {
    applied.push('.vscode/extensions.json');
  }

  for (const name of ['markdown-custom-dark.css', 'markdown-github-light.css'] as const) {
    const destPath = resolve(targetDir, '.vscode', name);
    if (fileExists(destPath)) {
      applied.push(`.vscode/${name}`);
      continue;
    }
    const src = resolveMarkdownCssTemplatePath(name);
    if (!src) {
      continue;
    }
    const body = await readFile(src, 'utf8');
    changes.push(createWritePreviewChange(destPath, '', body, `.vscode/${name} (markdown preview CSS)`));
  }

  const noopMessage =
    changes.length === 0
      ? 'Markdown linting already matches canonical configuration for owned files.'
      : undefined;

  const pkgWrite = changes.find((c) => c.kind === 'write' && c.path === packageJsonPath);
  const needsInstall =
    pkgWrite !== undefined &&
    pkgWrite.kind === 'write' &&
    packageJsonManifestDependencyFieldsChanged(pkgWrite.currentContent, pkgWrite.proposedContent);

  return {
    changes,
    applied,
    noopMessage,
    ...(needsInstall ? { needsInstall: true as const } : {}),
  };
}
