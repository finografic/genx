import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileExists, isDependencyDeclared } from 'utils';
import type { FeaturePreviewResult } from '../../lib/feature-preview/feature-preview.types.js';
import type { FeatureContext } from '../feature.types';

import { PACKAGE_JSON } from 'config/constants.config';
import type { PackageJson } from 'types/package-json.types';
import {
  createDeletePreviewChange,
  createWritePreviewChange,
} from '../../lib/feature-preview/feature-preview.utils.js';
import { OXFMT_LINT_STAGED_DATA_PATTERN_ALIASES } from '../oxfmt/oxfmt.constants.js';
import { packageJsonManifestDependencyFieldsChanged } from '../oxfmt/oxfmt.preview.js';
import {
  LINT_STAGED_DATA_ONLY_PATTERN,
  LINT_STAGED_MD_LINT_CMD,
  LINT_STAGED_MD_PATTERN,
  LINT_STAGED_OXFMT_CMD,
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

/**
 * Applies lint-staged markdown splits / `*.md` commands — same rules as `markdown.apply`.
 * Migrates `eslint --fix` → `md-lint --fix` on the `*.md` key when present.
 */
export function applyMarkdownLintStagedTransforms(packageJson: PackageJson): PackageJson {
  const lintStaged = { ...(packageJson['lint-staged'] as Record<string, string[]> | undefined) };
  if (!lintStaged || Object.keys(lintStaged).length === 0) {
    return packageJson;
  }

  const mdCommands = lintStaged[LINT_STAGED_MD_PATTERN];

  // Already fully configured with the new stack
  if (mdCommands?.some((c) => c.includes('oxfmt')) && mdCommands.includes(LINT_STAGED_MD_LINT_CMD)) {
    return packageJson;
  }

  // Migrate: has oxfmt + eslint --fix → replace eslint with md-lint --fix
  if (mdCommands?.some((c) => c.includes('oxfmt')) && mdCommands.some((c) => c.includes('eslint'))) {
    lintStaged[LINT_STAGED_MD_PATTERN] = mdCommands.map((c) =>
      c.includes('eslint') ? LINT_STAGED_MD_LINT_CMD : c,
    );
    return { ...packageJson, 'lint-staged': lintStaged };
  }

  // Has eslint only → replace with oxfmt + md-lint
  if (mdCommands?.some((c) => c.includes('eslint')) && !mdCommands.some((c) => c.includes('oxfmt'))) {
    lintStaged[LINT_STAGED_MD_PATTERN] = [LINT_STAGED_OXFMT_CMD, LINT_STAGED_MD_LINT_CMD];
    return { ...packageJson, 'lint-staged': lintStaged };
  }

  // Has oxfmt only → add md-lint
  if (mdCommands?.some((c) => c.includes('oxfmt')) && !mdCommands.some((c) => c.includes('eslint'))) {
    lintStaged[LINT_STAGED_MD_PATTERN] = [LINT_STAGED_OXFMT_CMD, LINT_STAGED_MD_LINT_CMD];
    return { ...packageJson, 'lint-staged': lintStaged };
  }

  const combinedKey = [...OXFMT_LINT_STAGED_DATA_PATTERN_ALIASES].find(
    (k) => lintStaged[k] && Array.isArray(lintStaged[k]),
  );
  const combined = combinedKey ? (lintStaged[combinedKey] as string[]) : undefined;

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
  const devDeps = packageJson.devDependencies as Record<string, string> | undefined;
  if (devDeps?.[MD_LINT_PACKAGE]) {
    return packageJson;
  }
  const devDependencies = {
    ...(packageJson.devDependencies ?? {}),
    [MD_LINT_PACKAGE]: MD_LINT_PACKAGE_VERSION,
  };
  return { ...packageJson, devDependencies };
}

function withMarkdownScripts(packageJson: PackageJson): PackageJson {
  const scripts = (packageJson.scripts as Record<string, string> | undefined) ?? {};
  if (scripts[MD_LINT_SCRIPT] !== undefined && scripts[MD_LINT_FIX_SCRIPT] !== undefined) {
    return packageJson;
  }
  const entries = Object.entries(scripts);
  const lintFixIdx = entries.findIndex(([k]) => k === 'lint:fix');
  const insertAt = lintFixIdx >= 0 ? lintFixIdx + 1 : entries.length;
  const next = [...entries];
  if (scripts[MD_LINT_SCRIPT] === undefined) {
    next.splice(insertAt, 0, [MD_LINT_SCRIPT, 'md-lint']);
  }
  if (scripts[MD_LINT_FIX_SCRIPT] === undefined) {
    const mdLintIdx = next.findIndex(([k]) => k === MD_LINT_SCRIPT);
    next.splice(mdLintIdx >= 0 ? mdLintIdx + 1 : insertAt + 1, 0, [MD_LINT_FIX_SCRIPT, 'md-lint --fix']);
  }
  return { ...packageJson, scripts: Object.fromEntries(next) };
}

/**
 * Propose adding a `lint.md` step to `.github/workflows/ci.yml` (after Lint, before Type check).
 * Returns null if the step is already present or the insertion point is not found.
 */
function proposeCiWithMarkdownLint(content: string): string | null {
  if (content.includes('lint.md') || content.includes('md-lint')) {
    return null;
  }
  const typeCheckStep = '\n      - name: Type check';
  if (!content.includes(typeCheckStep)) {
    return null;
  }
  const mdLintStep = '\n      - name: Lint markdown\n        run: pnpm lint.md';
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

  const hadDep = await isDependencyDeclared(targetDir, MD_LINT_PACKAGE);
  if (!hadDep) {
    pkg = withMarkdownDevDependency(pkg);
  }

  pkg = applyMarkdownLintStagedTransforms(pkg);
  pkg = withMarkdownScripts(pkg);

  const proposedPkgRaw = formatPackageJsonString(pkg);
  if (proposedPkgRaw !== rawPkg) {
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
        createWritePreviewChange(ciPath, ciRaw, proposedCi, '.github/workflows/ci.yml (lint.md step)'),
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
