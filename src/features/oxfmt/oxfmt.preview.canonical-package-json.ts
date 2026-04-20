import { policy } from '@finografic/deps-policy';

import {
  PACKAGE_JSON_SCRIPTS_PACKAGES_SECTION,
  PACKAGE_JSON_SCRIPTS_SECTION_DIVIDER,
  PACKAGE_JSON_SCRIPTS_SECTION_PREFIX,
} from 'config/constants.config';
import type { PackageJson } from 'types/package-json.types';
import {
  DPRINT_PACKAGES,
  FORMATTING_SCRIPTS,
  FORMATTING_SECTION_TITLE,
  OXFMT_CLI_PACKAGE,
  OXFMT_CONFIG_PACKAGE,
  OXFMT_LINT_STAGED_CODE_PATTERN,
  OXFMT_LINT_STAGED_COMMAND,
  OXFMT_LINT_STAGED_DATA_PATTERN,
  OXFMT_LINT_STAGED_DATA_PATTERN_ALIASES,
  OXFMT_LINT_STAGED_MD_PATTERN,
  OXFMT_UPDATE_SCRIPT,
  PRETTIER_PACKAGE_PATTERNS,
  PRETTIER_PACKAGES,
  SIMPLE_IMPORT_SORT_PACKAGE,
} from './oxfmt.constants.js';
import { stripDprintFromLintStaged, stripDprintFromScripts } from './oxfmt.dprint-cleanup.js';

function patternToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const regexStr = `^${escaped.replace(/\*/g, '.*')}$`;
  return new RegExp(regexStr);
}

function matchesPrettierPattern(packageName: string): boolean {
  return PRETTIER_PACKAGE_PATTERNS.some((pattern) => {
    const regex = patternToRegex(pattern);
    return regex.test(packageName);
  });
}

function collectPrettierPackageNames(packageJson: PackageJson): string[] {
  const allDeps = new Set<string>();
  if (packageJson.dependencies && typeof packageJson.dependencies === 'object') {
    for (const name of Object.keys(packageJson.dependencies)) {
      allDeps.add(name);
    }
  }
  if (packageJson.devDependencies && typeof packageJson.devDependencies === 'object') {
    for (const name of Object.keys(packageJson.devDependencies)) {
      allDeps.add(name);
    }
  }

  const matches: string[] = [];
  for (const dep of allDeps) {
    if (PRETTIER_PACKAGES.includes(dep as (typeof PRETTIER_PACKAGES)[number])) {
      matches.push(dep);
      continue;
    }
    if (matchesPrettierPattern(dep)) {
      matches.push(dep);
    }
  }
  return matches;
}

function stripListedDependencies(packageJson: PackageJson, names: string[]): PackageJson {
  if (names.length === 0) return packageJson;
  const next = JSON.parse(JSON.stringify(packageJson)) as PackageJson;
  const deps = { ...(next.dependencies as Record<string, string> | undefined) };
  const devDeps = { ...(next.devDependencies as Record<string, string> | undefined) };
  for (const n of names) {
    delete deps[n];
    delete devDeps[n];
  }
  next.dependencies = deps;
  next.devDependencies = devDeps;
  return next;
}

function applyDprintPackageJsonCleanup(packageJson: PackageJson): PackageJson {
  const next = JSON.parse(JSON.stringify(packageJson)) as PackageJson;
  const deps = { ...(next.dependencies as Record<string, string> | undefined) };
  const devDeps = { ...(next.devDependencies as Record<string, string> | undefined) };
  for (const pkg of DPRINT_PACKAGES) {
    delete deps[pkg];
    delete devDeps[pkg];
  }
  next.dependencies = deps;
  next.devDependencies = devDeps;
  if (next['lint-staged'] && typeof next['lint-staged'] === 'object') {
    const ls = { ...(next['lint-staged'] as Record<string, string[] | string>) };
    stripDprintFromLintStaged(ls);
    next['lint-staged'] = ls as Record<string, string[]>;
  }
  if (next.scripts) {
    const scripts = { ...next.scripts };
    stripDprintFromScripts(scripts);
    next.scripts = scripts;
  }
  return next;
}

function removeSimpleImportSortPackage(packageJson: PackageJson): PackageJson {
  const next = JSON.parse(JSON.stringify(packageJson)) as PackageJson;
  const devDeps = { ...(next.devDependencies as Record<string, string> | undefined) };
  const deps = { ...(next.dependencies as Record<string, string> | undefined) };
  delete devDeps[SIMPLE_IMPORT_SORT_PACKAGE];
  delete deps[SIMPLE_IMPORT_SORT_PACKAGE];
  next.devDependencies = devDeps;
  next.dependencies = deps;
  return next;
}

function ensureOxfmtPolicyDevDependencies(packageJson: PackageJson): PackageJson {
  const policyDev = policy.base.devDependencies as Record<string, string> | undefined;
  const dev = { ...(packageJson.devDependencies as Record<string, string> | undefined) };
  let changed = false;
  if (!dev[OXFMT_CLI_PACKAGE] && policyDev?.['oxfmt']) {
    dev[OXFMT_CLI_PACKAGE] = policyDev['oxfmt'];
    changed = true;
  }
  if (!dev[OXFMT_CONFIG_PACKAGE] && policyDev?.['@finografic/oxfmt-config']) {
    dev[OXFMT_CONFIG_PACKAGE] = policyDev['@finografic/oxfmt-config'];
    changed = true;
  }
  if (!changed) return packageJson;
  return { ...packageJson, devDependencies: dev };
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
  const { key } = OXFMT_UPDATE_SCRIPT;
  const { value } = OXFMT_UPDATE_SCRIPT;
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
  const scripts = { ...packageJson.scripts };

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
  const scripts = { ...packageJson.scripts };
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

function applyOxfmtPackageJsonLayoutTransforms(packageJson: PackageJson): PackageJson {
  let pkg: PackageJson = JSON.parse(JSON.stringify(packageJson)) as PackageJson;

  pkg = addFormattingScriptsPure(pkg);
  pkg = ensureFormattingScriptsPlacementPure(pkg);
  pkg = addUpdateScriptPure(pkg);
  pkg = addFormatToReleaseCheckPure(pkg);
  pkg = addOxfmtToLintStagedPure(pkg);

  return pkg;
}

/**
 * Full canonical `package.json` after oxfmt apply: Prettier/dprint/simple-import-sort cleanup,
 * policy devDependencies, then scripts / lint-staged layout (matches `applyOxfmt` ordering).
 */
export function computeCanonicalOxfmtPackageJson(source: PackageJson): PackageJson {
  let pkg: PackageJson = JSON.parse(JSON.stringify(source)) as PackageJson;

  const prettierNames = collectPrettierPackageNames(pkg);
  pkg = stripListedDependencies(pkg, prettierNames);
  pkg = applyDprintPackageJsonCleanup(pkg);
  pkg = removeSimpleImportSortPackage(pkg);
  pkg = ensureOxfmtPolicyDevDependencies(pkg);
  pkg = applyOxfmtPackageJsonLayoutTransforms(pkg);

  return pkg;
}
