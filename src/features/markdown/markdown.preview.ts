import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sortedRecord } from '@finografic/cli-kit/package-manager';
import { fileExists, isDependencyDeclared, jsonLikeTextsEquivalent, parseJsoncObject } from 'utils';
import type { FeaturePreviewResult } from '../../lib/feature-preview/feature-preview.types.js';
import type { FeatureContext } from '../feature.types';

import { PACKAGE_JSON } from 'config/constants.config';
import type { PackageJson } from 'types/package-json.types';

import {
  createDeletePreviewChange,
  createWritePreviewChange,
} from '../../lib/feature-preview/feature-preview.utils.js';
import { OXFMT_LINT_STAGED_DATA_PATTERN_ALIASES } from '../oxc-config/oxc-config.constants.js';
import { packageJsonManifestDependencyFieldsChanged } from '../oxc-config/oxc-config.preview.js';
import {
  LINT_STAGED_DATA_ONLY_PATTERN,
  LINT_STAGED_MD_LINT_CMD,
  LINT_STAGED_MD_PATTERN,
  LINT_STAGED_OXFMT_CMD,
  MARKDOWNLINT_CONFIG_EXTENDS_KEY,
  MARKDOWNLINT_CONFIG_EXTENDS_VALUE,
  MARKDOWNLINT_CONFIG_FILE,
  MARKDOWNLINT_CONFIG_FILE_TEXT,
  MD_LINT_CSS_FILES,
  MD_LINT_FIX_SCRIPT,
  MD_LINT_PACKAGE,
  MD_LINT_PACKAGE_VERSION,
  MD_LINT_SCRIPT,
} from './markdown.constants';
import {
  computeProposedMarkdownExtensionsText,
  computeProposedMarkdownSettingsText,
} from './markdown.vscode';

function formatPackageJsonString(packageJson: PackageJson): string {
  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

function computeProposedMarkdownlintConfigText(currentRaw: string): string {
  if (currentRaw) {
    try {
      const parsed = parseJsoncObject(currentRaw);
      if (parsed[MARKDOWNLINT_CONFIG_EXTENDS_KEY] === MARKDOWNLINT_CONFIG_EXTENDS_VALUE) {
        return currentRaw;
      }
    } catch {
      // Fall through to canonical rewrite for invalid/partial JSONC.
    }
  }

  return MARKDOWNLINT_CONFIG_FILE_TEXT;
}

/**
 * Applies lint-staged markdown splits / `*.md` commands. Ensures `*.md` key has both oxfmt and md-lint.
 */
export function applyMarkdownLintStagedTransforms(packageJson: PackageJson): PackageJson {
  const lintStaged = { ...packageJson['lint-staged'] };
  if (!lintStaged || Object.keys(lintStaged).length === 0) {
    return packageJson;
  }

  const mdCommands = lintStaged[LINT_STAGED_MD_PATTERN];

  if (mdCommands?.some((c) => c.includes('oxfmt')) && mdCommands.includes(LINT_STAGED_MD_LINT_CMD)) {
    return packageJson;
  }

  if (mdCommands?.some((c) => c.includes('oxfmt')) && !mdCommands.includes(LINT_STAGED_MD_LINT_CMD)) {
    lintStaged[LINT_STAGED_MD_PATTERN] = [LINT_STAGED_OXFMT_CMD, LINT_STAGED_MD_LINT_CMD];
    return { ...packageJson, 'lint-staged': lintStaged };
  }

  const combinedKey = [...OXFMT_LINT_STAGED_DATA_PATTERN_ALIASES].find(
    (k) => lintStaged[k] && Array.isArray(lintStaged[k]),
  );
  const combined = combinedKey ? lintStaged[combinedKey] : undefined;

  if (combined && combined.includes(LINT_STAGED_OXFMT_CMD) && !combined.some((c) => c.includes('eslint'))) {
    lintStaged[LINT_STAGED_DATA_ONLY_PATTERN] = [LINT_STAGED_OXFMT_CMD];
    if (combinedKey) delete lintStaged[combinedKey];
    lintStaged[LINT_STAGED_MD_PATTERN] = [LINT_STAGED_OXFMT_CMD, LINT_STAGED_MD_LINT_CMD];
    return { ...packageJson, 'lint-staged': lintStaged };
  }

  const dataOnly = lintStaged[LINT_STAGED_DATA_ONLY_PATTERN];
  if (dataOnly && !lintStaged[LINT_STAGED_MD_PATTERN]) {
    lintStaged[LINT_STAGED_MD_PATTERN] = [LINT_STAGED_OXFMT_CMD, LINT_STAGED_MD_LINT_CMD];
    return { ...packageJson, 'lint-staged': lintStaged };
  }

  return packageJson;
}

function withMarkdownDevDependency(packageJson: PackageJson): PackageJson {
  const devDeps = packageJson.devDependencies;
  if (devDeps?.[MD_LINT_PACKAGE]) {
    return packageJson;
  }
  const devDependencies = sortedRecord({
    ...packageJson.devDependencies,
    [MD_LINT_PACKAGE]: MD_LINT_PACKAGE_VERSION,
  });
  return { ...packageJson, devDependencies };
}

function withMarkdownScripts(packageJson: PackageJson): PackageJson {
  const scripts = packageJson.scripts ?? {};
  const entries = Object.entries(scripts).filter(
    ([key]) => key !== MD_LINT_SCRIPT && key !== MD_LINT_FIX_SCRIPT,
  );
  const lintCiIdx = entries.findIndex(([key]) => key === 'lint:ci');
  const lintFixIdx = entries.findIndex(([key]) => key === 'lint:fix');
  const insertAt = lintCiIdx >= 0 ? lintCiIdx + 1 : lintFixIdx >= 0 ? lintFixIdx + 1 : entries.length;

  entries.splice(
    insertAt,
    0,
    [MD_LINT_SCRIPT, scripts[MD_LINT_SCRIPT] ?? 'md-lint'],
    [MD_LINT_FIX_SCRIPT, scripts[MD_LINT_FIX_SCRIPT] ?? 'md-lint --fix'],
  );

  const nextScripts = Object.fromEntries(entries);
  return JSON.stringify(nextScripts) === JSON.stringify(scripts)
    ? packageJson
    : { ...packageJson, scripts: nextScripts };
}

/**
 * Propose adding a `lint:md` step to `.github/workflows/ci.yml` (after Lint, before Type check). Returns null
 * if the step is already present or the insertion point is not found.
 */
function proposeCiWithMarkdownLint(content: string): string | null {
  if (content.includes('lint:md') || content.includes('md-lint')) {
    return null;
  }
  const typeCheckStep = '\n      - name: Type check';
  if (!content.includes(typeCheckStep)) {
    return null;
  }
  const mdLintStep = '\n      - name: Lint markdown\n        run: pnpm lint:md';
  return content.replace(typeCheckStep, `${mdLintStep}\n${typeCheckStep}`);
}

/**
 * Preview markdown feature ownership: package.json, VS Code, lint-staged, CSS cleanup, CI.
 */
export async function previewMarkdown(context: FeatureContext): Promise<FeaturePreviewResult> {
  const { targetDir } = context;
  const changes: FeaturePreviewResult['changes'] = [];
  const applied: string[] = [];

  const packageJsonPath = resolve(targetDir, PACKAGE_JSON);
  const rawPkg = await readFile(packageJsonPath, 'utf8');
  let pkg = JSON.parse(rawPkg) as PackageJson;

  // Skip self-install: md-lint is the markdown linter itself — don't add it as its own devDep.
  if ((pkg as Record<string, unknown>)['name'] === MD_LINT_PACKAGE) {
    return { changes: [], applied: [], noopMessage: `Skipped — target is ${MD_LINT_PACKAGE} itself.` };
  }

  const hadDep = await isDependencyDeclared(targetDir, MD_LINT_PACKAGE);
  if (!hadDep) {
    pkg = withMarkdownDevDependency(pkg);
  }

  pkg = applyMarkdownLintStagedTransforms(pkg);
  pkg = withMarkdownScripts(pkg);

  const proposedPkgRaw = formatPackageJsonString(pkg);
  if (!jsonLikeTextsEquivalent(proposedPkgRaw, rawPkg)) {
    changes.push(
      createWritePreviewChange(
        packageJsonPath,
        rawPkg,
        proposedPkgRaw,
        'package.json (md-lint, scripts, lint-staged)',
      ),
    );
  } else {
    applied.push('package.json (markdown manifest)');
  }

  const settings = await computeProposedMarkdownSettingsText(targetDir);
  if (!jsonLikeTextsEquivalent(settings.proposed, settings.current)) {
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

  const markdownlintConfigPath = resolve(targetDir, MARKDOWNLINT_CONFIG_FILE);
  const currentMarkdownlintConfig = fileExists(markdownlintConfigPath)
    ? await readFile(markdownlintConfigPath, 'utf8')
    : '';
  const proposedMarkdownlintConfig = computeProposedMarkdownlintConfigText(currentMarkdownlintConfig);
  if (!jsonLikeTextsEquivalent(proposedMarkdownlintConfig, currentMarkdownlintConfig)) {
    changes.push(
      createWritePreviewChange(
        markdownlintConfigPath,
        currentMarkdownlintConfig,
        proposedMarkdownlintConfig,
        MARKDOWNLINT_CONFIG_FILE,
      ),
    );
  } else {
    applied.push(MARKDOWNLINT_CONFIG_FILE);
  }

  const ext = await computeProposedMarkdownExtensionsText(targetDir);
  if (!jsonLikeTextsEquivalent(ext.proposed, ext.current)) {
    changes.push(
      createWritePreviewChange(ext.path, ext.current, ext.proposed, '.vscode/extensions.json (markdownlint)'),
    );
  } else {
    applied.push('.vscode/extensions.json');
  }

  for (const cssFile of MD_LINT_CSS_FILES) {
    const cssPath = resolve(targetDir, '.vscode', cssFile);
    if (fileExists(cssPath)) {
      const cssBody = await readFile(cssPath, 'utf8');
      changes.push(
        createDeletePreviewChange(cssPath, cssBody, true, `.vscode/${cssFile} (moved to md-lint package)`),
      );
    }
  }

  const ciPath = resolve(targetDir, '.github/workflows/ci.yml');
  if (fileExists(ciPath)) {
    const ciRaw = await readFile(ciPath, 'utf8');
    const proposedCi = proposeCiWithMarkdownLint(ciRaw);
    if (proposedCi !== null) {
      changes.push(
        createWritePreviewChange(ciPath, ciRaw, proposedCi, '.github/workflows/ci.yml (lint:md step)'),
      );
    } else {
      applied.push('.github/workflows/ci.yml');
    }
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
