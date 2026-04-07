import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type {
  FeaturePreviewChange,
  FeaturePreviewResult,
} from '../../lib/feature-preview/feature-preview.types.js';
import type { FeatureContext } from '../feature.types';

import {
  PACKAGE_JSON,
  PACKAGE_JSON_SCRIPTS_PACKAGES_SECTION,
  PACKAGE_JSON_SCRIPTS_SECTION_DIVIDER,
  PACKAGE_JSON_SCRIPTS_SECTION_PREFIX,
} from 'config/constants.config';
import type { PackageJson } from 'types/package-json.types';
import { createWritePreviewChange } from '../../lib/feature-preview/feature-preview.utils.js';
import {
  FORMATTING_SCRIPTS,
  FORMATTING_SECTION_TITLE,
  OXFMT_LINT_STAGED_CODE_PATTERN,
  OXFMT_LINT_STAGED_COMMAND,
  OXFMT_LINT_STAGED_DATA_PATTERN,
  OXFMT_LINT_STAGED_DATA_PATTERN_ALIASES,
  OXFMT_LINT_STAGED_MD_PATTERN,
  OXFMT_UPDATE_SCRIPT,
} from './oxfmt.constants.js';
import { getOxfmtConfigCanonicalFileContent } from './oxfmt.template.js';

function isEnoent(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOENT'
  );
}

function formatPackageJsonString(packageJson: PackageJson): string {
  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

function findNextScriptsSectionDividerIndex(keys: string[], sectionKeyIndex: number): number {
  const prefix = PACKAGE_JSON_SCRIPTS_SECTION_PREFIX;
  const current = keys[sectionKeyIndex];
  for (let i = sectionKeyIndex + 1; i < keys.length; i++) {
    const k = keys[i];
    if (k.startsWith(prefix) && k !== current) {
      return i;
    }
  }
  return keys.length;
}

function ensureUpdateOxfmtScriptPlacement(scripts: Record<string, string>): {
  next: Record<string, string>;
  changed: boolean;
} {
  const key = OXFMT_UPDATE_SCRIPT.key;
  const value = OXFMT_UPDATE_SCRIPT.value;
  const keys = Object.keys(scripts);

  const packagesIdx = keys.indexOf(PACKAGE_JSON_SCRIPTS_PACKAGES_SECTION);
  if (packagesIdx === -1) {
    if (scripts[key] === value) {
      return { next: scripts, changed: false };
    }
    return { next: { ...scripts, [key]: value }, changed: true };
  }

  const nextSectionIdx = findNextScriptsSectionDividerIndex(keys, packagesIdx);
  const sectionKeys = keys.slice(packagesIdx + 1, nextSectionIdx);

  let insertAfter: string;
  if (sectionKeys.includes('update:eslint-config')) {
    insertAfter = 'update:eslint-config';
  } else {
    const updateKeys = sectionKeys.filter((k) => k.startsWith('update:'));
    insertAfter =
      updateKeys.length > 0 ? updateKeys[updateKeys.length - 1]! : PACKAGE_JSON_SCRIPTS_PACKAGES_SECTION;
  }

  const without = keys.filter((k) => k !== key);
  const insertAt = without.indexOf(insertAfter) + 1;
  const newKeys = [...without.slice(0, insertAt), key, ...without.slice(insertAt)];

  const next: Record<string, string> = {};
  for (const k of newKeys) {
    next[k] = k === key ? value : scripts[k];
  }

  const changed = scripts[key] !== value || JSON.stringify(keys) !== JSON.stringify(newKeys);

  return { next, changed };
}

function coerceLintStagedStringValuesToArrays(lintStaged: Record<string, string[] | string>): void {
  for (const k of Object.keys(lintStaged)) {
    const v = lintStaged[k];
    if (typeof v === 'string') {
      lintStaged[k] = [v];
    }
  }
}

function mergeDataGlobAliasesIntoCanonical(lintStaged: Record<string, string[] | string>): void {
  const canonical = OXFMT_LINT_STAGED_DATA_PATTERN;
  let oxfmtCmd = OXFMT_LINT_STAGED_COMMAND;

  for (const key of OXFMT_LINT_STAGED_DATA_PATTERN_ALIASES) {
    const cmds = lintStaged[key];
    if (!Array.isArray(cmds)) continue;
    const found = cmds.find((c) => c.includes('oxfmt'));
    if (found) oxfmtCmd = found;
  }

  const canCmds = lintStaged[canonical];
  if (Array.isArray(canCmds)) {
    const found = canCmds.find((c) => c.includes('oxfmt'));
    if (found) oxfmtCmd = found;
  }

  for (const key of OXFMT_LINT_STAGED_DATA_PATTERN_ALIASES) {
    delete lintStaged[key];
  }

  const finalCmds = [oxfmtCmd].filter((c) => !c.includes('eslint'));
  lintStaged[canonical] = finalCmds.length > 0 ? finalCmds : [OXFMT_LINT_STAGED_COMMAND];
}

function normalizeCodeGlobOxfmtFirst(lintStaged: Record<string, string[] | string>): void {
  const pattern = OXFMT_LINT_STAGED_CODE_PATTERN;
  const cmds = lintStaged[pattern];
  if (!Array.isArray(cmds) || cmds.length === 0) return;

  const eslintFix = cmds.find((c) => c === 'eslint --fix');
  const eslintOther = cmds.find((c) => c.includes('eslint') && !eslintFix);
  const eslint = eslintFix ?? eslintOther;
  lintStaged[pattern] = eslint ? [OXFMT_LINT_STAGED_COMMAND, eslint] : [OXFMT_LINT_STAGED_COMMAND];
}

function normalizeMdGlobOxfmtFirst(lintStaged: Record<string, string[] | string>): void {
  const pattern = OXFMT_LINT_STAGED_MD_PATTERN;
  const cmds = lintStaged[pattern];
  if (!Array.isArray(cmds) || cmds.length === 0) {
    lintStaged[pattern] = [OXFMT_LINT_STAGED_COMMAND, 'eslint --fix'];
    return;
  }

  const filtered = cmds.filter((c) => !c.includes('dprint'));
  const eslintFix = filtered.find((c) => c === 'eslint --fix');
  const eslintOther = filtered.find((c) => c.includes('eslint') && !eslintFix);
  const eslint = eslintFix ?? eslintOther ?? 'eslint --fix';

  lintStaged[pattern] = [OXFMT_LINT_STAGED_COMMAND, eslint];
}

const LINT_STAGED_KEY_ORDER = [
  OXFMT_LINT_STAGED_CODE_PATTERN,
  OXFMT_LINT_STAGED_MD_PATTERN,
  OXFMT_LINT_STAGED_DATA_PATTERN,
] as const;

function reorderLintStagedKeys(
  lintStaged: Record<string, string[] | string>,
): Record<string, string[] | string> {
  const next: Record<string, string[] | string> = {};
  for (const k of LINT_STAGED_KEY_ORDER) {
    if (k in lintStaged) next[k] = lintStaged[k];
  }
  for (const k of Object.keys(lintStaged)) {
    if (!(k in next)) next[k] = lintStaged[k];
  }
  return next;
}

function hasFormattingScripts(scripts: Record<string, string>): boolean {
  return 'format' in scripts || 'format:check' in scripts;
}

function hasFormattingSectionTitle(scripts: Record<string, string>): boolean {
  return Object.keys(scripts).some((key) => key === FORMATTING_SECTION_TITLE);
}

function findFormattingInsertionPoint(scripts: Record<string, string>): number {
  if (hasFormattingScripts(scripts)) {
    return -1;
  }

  const scriptKeys = Object.keys(scripts);
  const formattingTitleIdx = scriptKeys.indexOf(FORMATTING_SECTION_TITLE);

  if (formattingTitleIdx !== -1) {
    return formattingTitleIdx + 1;
  }

  const lintingIndex = scriptKeys.findIndex((key) => key.includes('LINTING'));
  if (lintingIndex !== -1) {
    let insertAfter = lintingIndex;
    for (let i = lintingIndex + 1; i < scriptKeys.length; i++) {
      const key = scriptKeys[i];
      if (key.startsWith(PACKAGE_JSON_SCRIPTS_SECTION_PREFIX)) {
        break;
      }
      insertAfter = i;
    }
    return insertAfter + 1;
  }

  return scriptKeys.length;
}

function ensureFormattingScriptsUnderFormattingHeader(scripts: Record<string, string>): {
  next: Record<string, string>;
  changed: boolean;
} {
  const keys = Object.keys(scripts);
  const titleIdx = keys.indexOf(FORMATTING_SECTION_TITLE);
  if (titleIdx === -1) {
    return { next: scripts, changed: false };
  }

  const formatKeys = (['format:check', 'format:fix'] as const).filter((k) => k in scripts);
  if (formatKeys.length === 0) {
    return { next: scripts, changed: false };
  }

  const firstFmtIdx = Math.min(...formatKeys.map((k) => keys.indexOf(k)));
  if (firstFmtIdx > titleIdx) {
    return { next: scripts, changed: false };
  }

  const baseKeys = keys.filter((k) => k !== 'format:check' && k !== 'format:fix');
  const titlePos = baseKeys.indexOf(FORMATTING_SECTION_TITLE);
  if (titlePos === -1) {
    return { next: scripts, changed: false };
  }

  const newKeys = [...baseKeys.slice(0, titlePos + 1), ...formatKeys, ...baseKeys.slice(titlePos + 1)];
  const next: Record<string, string> = {};
  for (const k of newKeys) {
    next[k] = scripts[k];
  }

  return { next, changed: true };
}

function addFormattingScriptsPure(packageJson: PackageJson): PackageJson {
  const scripts = { ...(packageJson.scripts ?? {}) };

  if (hasFormattingScripts(scripts)) {
    return packageJson;
  }

  const scriptKeys = Object.keys(scripts);
  const insertionPoint = findFormattingInsertionPoint(scripts);

  if (insertionPoint === -1) {
    return packageJson;
  }

  const newScripts: Record<string, string> = {};

  for (let i = 0; i < insertionPoint; i++) {
    const key = scriptKeys[i];
    newScripts[key] = scripts[key];
  }

  if (!hasFormattingSectionTitle(scripts)) {
    newScripts[FORMATTING_SECTION_TITLE] = PACKAGE_JSON_SCRIPTS_SECTION_DIVIDER;
  }

  for (const [scriptKey, scriptValue] of Object.entries(FORMATTING_SCRIPTS)) {
    newScripts[scriptKey] = scriptValue;
  }

  for (let i = insertionPoint; i < scriptKeys.length; i++) {
    const key = scriptKeys[i];
    newScripts[key] = scripts[key];
  }

  return { ...packageJson, scripts: newScripts };
}

function ensureFormattingScriptsPlacementPure(packageJson: PackageJson): PackageJson {
  const { next, changed } = ensureFormattingScriptsUnderFormattingHeader(packageJson.scripts ?? {});
  if (!changed) return packageJson;
  return { ...packageJson, scripts: next };
}

function addUpdateScriptPure(packageJson: PackageJson): PackageJson {
  const scripts = packageJson.scripts ?? {};
  const { next, changed } = ensureUpdateOxfmtScriptPlacement(scripts);
  if (!changed) return packageJson;
  return { ...packageJson, scripts: next };
}

function addFormatToReleaseCheckPure(packageJson: PackageJson): PackageJson {
  const scripts = { ...(packageJson.scripts ?? {}) };
  const releaseCheck = scripts['release:check'];
  if (!releaseCheck || releaseCheck.includes('format:check')) return packageJson;

  scripts['release:check'] = `pnpm format:check && ${releaseCheck}`;
  return { ...packageJson, scripts };
}

function addOxfmtToLintStagedPure(packageJson: PackageJson): PackageJson {
  const lintStaged = {
    ...((packageJson['lint-staged'] ?? {}) as Record<string, string[] | string>),
  };
  const before = JSON.stringify(lintStaged);

  coerceLintStagedStringValuesToArrays(lintStaged);
  mergeDataGlobAliasesIntoCanonical(lintStaged);

  const codePattern = OXFMT_LINT_STAGED_CODE_PATTERN;
  const codeCommands = lintStaged[codePattern];
  if (!Array.isArray(codeCommands) || codeCommands.length === 0) {
    lintStaged[codePattern] = [OXFMT_LINT_STAGED_COMMAND, 'eslint --fix'];
  } else if (!codeCommands.some((c) => c.includes('oxfmt'))) {
    lintStaged[codePattern] = [
      OXFMT_LINT_STAGED_COMMAND,
      ...codeCommands.filter((c) => !c.includes('dprint')),
    ];
  }
  normalizeCodeGlobOxfmtFirst(lintStaged);

  const dataPattern = OXFMT_LINT_STAGED_DATA_PATTERN;
  const dataCmds = lintStaged[dataPattern];
  if (!Array.isArray(dataCmds) || dataCmds.length === 0) {
    lintStaged[dataPattern] = [OXFMT_LINT_STAGED_COMMAND];
  } else if (!dataCmds.some((c) => c.includes('oxfmt'))) {
    lintStaged[dataPattern] = [OXFMT_LINT_STAGED_COMMAND, ...dataCmds.filter((c) => !c.includes('eslint'))];
    const stripped = (lintStaged[dataPattern] as string[]).filter((c) => !c.includes('eslint'));
    lintStaged[dataPattern] = stripped.length > 0 ? stripped : [OXFMT_LINT_STAGED_COMMAND];
  } else {
    const stripped = dataCmds.filter((c) => !c.includes('eslint'));
    lintStaged[dataPattern] = stripped.length > 0 ? stripped : [OXFMT_LINT_STAGED_COMMAND];
  }

  normalizeMdGlobOxfmtFirst(lintStaged);

  const reordered = reorderLintStagedKeys(lintStaged);

  if (before === JSON.stringify(reordered)) return packageJson;

  return { ...packageJson, 'lint-staged': reordered as Record<string, string[]> };
}

/**
 * Applies the same in-memory package.json transforms as `applyOxfmt` for `package.json`
 * (formatting scripts → placement → `update:oxfmt-config` → `release:check` → `lint-staged`).
 */
export function computeCanonicalOxfmtPackageJson(source: PackageJson): PackageJson {
  let packageJson: PackageJson = JSON.parse(JSON.stringify(source)) as PackageJson;

  packageJson = addFormattingScriptsPure(packageJson);
  packageJson = ensureFormattingScriptsPlacementPure(packageJson);
  packageJson = addUpdateScriptPure(packageJson);
  packageJson = addFormatToReleaseCheckPure(packageJson);
  packageJson = addOxfmtToLintStagedPure(packageJson);

  return packageJson;
}

const OXFMT_CONFIG_FILENAME = 'oxfmt.config.ts';

/**
 * Preview canonical oxfmt outputs for `package.json` and `oxfmt.config.ts` (aligned with apply order
 * for those files). Used for migrate detection and future apply preview.
 */
export async function previewOxfmt(context: FeatureContext): Promise<FeaturePreviewResult> {
  const packageJsonPath = resolve(context.targetDir, PACKAGE_JSON);
  const configPath = resolve(context.targetDir, OXFMT_CONFIG_FILENAME);

  const currentPkgRaw = await readFile(packageJsonPath, 'utf8');
  const currentPkg = JSON.parse(currentPkgRaw) as PackageJson;
  const canonicalPkg = computeCanonicalOxfmtPackageJson(currentPkg);
  const proposedPkgRaw = formatPackageJsonString(canonicalPkg);

  const changes: FeaturePreviewChange[] = [];
  const applied: string[] = [];

  if (proposedPkgRaw !== currentPkgRaw) {
    changes.push(
      createWritePreviewChange(
        packageJsonPath,
        currentPkgRaw,
        proposedPkgRaw,
        'package.json (oxfmt scripts, lint-staged, release:check)',
      ),
    );
  } else {
    applied.push('package.json (oxfmt canonical layout)');
  }

  const canonicalConfig = getOxfmtConfigCanonicalFileContent();
  let currentConfig = '';
  try {
    currentConfig = await readFile(configPath, 'utf8');
  } catch (error) {
    if (!isEnoent(error)) throw error;
  }

  if (currentConfig !== canonicalConfig) {
    changes.push(createWritePreviewChange(configPath, currentConfig, canonicalConfig, OXFMT_CONFIG_FILENAME));
  } else {
    applied.push(OXFMT_CONFIG_FILENAME);
  }

  const noopMessage =
    changes.length === 0
      ? 'oxfmt already matches canonical configuration (package.json + oxfmt.config.ts).'
      : undefined;

  return { changes, applied, noopMessage };
}
