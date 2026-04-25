import { formatting, linting } from '@finografic/deps-policy';

import {
  PACKAGE_JSON_SCRIPTS_PACKAGES_SECTION,
  PACKAGE_JSON_SCRIPTS_SECTION_DIVIDER,
  PACKAGE_JSON_SCRIPTS_SECTION_PREFIX,
} from 'config/constants.config';
import type { PackageJson } from 'types/package-json.types';

import {
  DPRINT_PACKAGES,
  ESLINT_PACKAGES_TO_REMOVE,
  FORMATTING_SCRIPTS,
  FORMATTING_SECTION_TITLE,
  LEGACY_OXFMT_CONFIG_PACKAGE,
  LEGACY_OXFMT_UPDATE_SCRIPT_KEY,
  OXC_CONFIG_PACKAGE,
  OXFMT_CLI_PACKAGE,
  OXFMT_LINT_STAGED_CODE_PATTERN,
  OXFMT_LINT_STAGED_COMMAND,
  OXFMT_LINT_STAGED_DATA_PATTERN,
  OXFMT_LINT_STAGED_DATA_PATTERN_ALIASES,
  OXFMT_LINT_STAGED_MD_PATTERN,
  OXFMT_UPDATE_SCRIPT,
  OXLINT_LINT_STAGED_COMMAND,
  OXLINT_PACKAGE,
  PRETTIER_PACKAGE_PATTERNS,
  PRETTIER_PACKAGES,
  SIMPLE_IMPORT_SORT_PACKAGE,
} from './oxc-config.constants.js';
import { stripDprintFromLintStaged, stripDprintFromScripts } from './oxc-config.dprint-cleanup.js';

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

// DEPRECATED: @finografic/oxfmt-config replaced by @finografic/oxc-config. Remove on apply.
function removeLegacyOxfmtConfigPackage(packageJson: PackageJson): PackageJson {
  return stripListedDependencies(packageJson, [LEGACY_OXFMT_CONFIG_PACKAGE]);
}

// DEPRECATED: ESLint stack replaced by oxlint. Remove on apply.
function removeEslintPackages(packageJson: PackageJson): PackageJson {
  return stripListedDependencies(packageJson, [...ESLINT_PACKAGES_TO_REMOVE]);
}

function ensureOxcToolchainDevDependencies(packageJson: PackageJson): PackageJson {
  const dev = { ...(packageJson.devDependencies as Record<string, string> | undefined) };
  let changed = false;

  if (!dev[OXFMT_CLI_PACKAGE] && formatting['oxfmt']) {
    dev[OXFMT_CLI_PACKAGE] = formatting['oxfmt'];
    changed = true;
  }
  if (!dev[OXC_CONFIG_PACKAGE] && linting['@finografic/oxc-config']) {
    dev[OXC_CONFIG_PACKAGE] = linting['@finografic/oxc-config'];
    changed = true;
  }
  if (!dev[OXLINT_PACKAGE] && linting['oxlint']) {
    dev[OXLINT_PACKAGE] = linting['oxlint'];
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

function ensureUpdateOxcScriptPlacement(scripts: Record<string, string>): {
  next: Record<string, string>;
  changed: boolean;
} {
  const { key } = OXFMT_UPDATE_SCRIPT;
  const { value } = OXFMT_UPDATE_SCRIPT;
  const keys = Object.keys(scripts);

  // Remove legacy update script key alongside the new one
  const without = keys.filter((k) => k !== key && k !== LEGACY_OXFMT_UPDATE_SCRIPT_KEY);

  const packagesIdx = without.indexOf(PACKAGE_JSON_SCRIPTS_PACKAGES_SECTION);
  if (packagesIdx === -1) {
    const alreadyCorrect = scripts[key] === value && !scripts[LEGACY_OXFMT_UPDATE_SCRIPT_KEY];
    if (alreadyCorrect) {
      return { next: scripts, changed: false };
    }
    const next: Record<string, string> = {};
    for (const k of without) {
      next[k] = scripts[k];
    }
    next[key] = value;
    return { next, changed: true };
  }

  const nextSectionIdx = findNextScriptsSectionDividerIndex(without, packagesIdx);
  const sectionKeys = without.slice(packagesIdx + 1, nextSectionIdx);

  const updateKeys = sectionKeys.filter((k) => k.startsWith('update:'));
  const insertAfter =
    updateKeys.length > 0 ? updateKeys[updateKeys.length - 1]! : PACKAGE_JSON_SCRIPTS_PACKAGES_SECTION;

  const insertAt = without.indexOf(insertAfter) + 1;
  const newKeys = [...without.slice(0, insertAt), key, ...without.slice(insertAt)];

  const next: Record<string, string> = {};
  for (const k of newKeys) {
    next[k] = k === key ? value : scripts[k]!;
  }

  const changed =
    scripts[key] !== value ||
    !!scripts[LEGACY_OXFMT_UPDATE_SCRIPT_KEY] ||
    JSON.stringify(Object.keys(scripts).filter((k) => k !== LEGACY_OXFMT_UPDATE_SCRIPT_KEY)) !==
      JSON.stringify(newKeys);

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
  if (!Array.isArray(cmds) || cmds.length === 0) {
    lintStaged[pattern] = [OXFMT_LINT_STAGED_COMMAND, OXLINT_LINT_STAGED_COMMAND];
    return;
  }

  // DEPRECATED: eslint commands removed — replaced by oxlint.
  const withoutEslint = cmds.filter((c) => !c.includes('eslint'));
  const hasOxfmt = withoutEslint.some((c) => c.includes('oxfmt'));
  const hasOxlint = withoutEslint.some((c) => c.includes('oxlint'));

  const result: string[] = [];
  if (hasOxfmt) {
    result.push(withoutEslint.find((c) => c.includes('oxfmt'))!);
  } else {
    result.push(OXFMT_LINT_STAGED_COMMAND);
  }
  if (hasOxlint) {
    result.push(...withoutEslint.filter((c) => c.includes('oxlint')));
  } else {
    result.push(OXLINT_LINT_STAGED_COMMAND);
  }
  // Preserve any other non-eslint commands
  result.push(...withoutEslint.filter((c) => !c.includes('oxfmt') && !c.includes('oxlint')));

  lintStaged[pattern] = result;
}

function normalizeMdGlobOxfmtFirst(lintStaged: Record<string, string[] | string>): void {
  const pattern = OXFMT_LINT_STAGED_MD_PATTERN;
  const cmds = lintStaged[pattern];

  if (!Array.isArray(cmds) || cmds.length === 0) {
    lintStaged[pattern] = [OXFMT_LINT_STAGED_COMMAND, OXLINT_LINT_STAGED_COMMAND];
    return;
  }

  // DEPRECATED: eslint commands removed — replaced by oxlint.
  const withoutEslint = cmds.filter((c) => !c.includes('eslint'));
  const hasOxfmt = withoutEslint.some((c) => c.includes('oxfmt'));
  const hasMdLint = withoutEslint.some((c) => c.includes('md-lint'));
  const hasOxlint = withoutEslint.some((c) => c.includes('oxlint'));

  const result: string[] = [];
  if (hasOxfmt) {
    result.push(withoutEslint.find((c) => c.includes('oxfmt'))!);
  } else {
    result.push(OXFMT_LINT_STAGED_COMMAND);
  }
  // Prefer md-lint if present; otherwise use oxlint
  if (hasMdLint) {
    result.push(...withoutEslint.filter((c) => c.includes('md-lint')));
  } else if (hasOxlint) {
    result.push(...withoutEslint.filter((c) => c.includes('oxlint')));
  } else {
    result.push(OXLINT_LINT_STAGED_COMMAND);
  }

  lintStaged[pattern] = result;
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
  const { next, changed } = ensureUpdateOxcScriptPlacement(scripts);
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
    lintStaged[codePattern] = [OXFMT_LINT_STAGED_COMMAND, OXLINT_LINT_STAGED_COMMAND];
  }
  normalizeCodeGlobOxfmtFirst(lintStaged);

  const dataPattern = OXFMT_LINT_STAGED_DATA_PATTERN;
  const dataCmds = lintStaged[dataPattern];
  if (!Array.isArray(dataCmds) || dataCmds.length === 0) {
    lintStaged[dataPattern] = [OXFMT_LINT_STAGED_COMMAND];
  } else {
    // DEPRECATED: remove any eslint commands from data glob
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
 * Full canonical `package.json` after oxc-config apply: Prettier/dprint/simple-import-sort/eslint cleanup,
 * policy devDependencies, then scripts / lint-staged layout.
 */
export function computeCanonicalOxfmtPackageJson(source: PackageJson): PackageJson {
  let pkg: PackageJson = JSON.parse(JSON.stringify(source)) as PackageJson;

  const prettierNames = collectPrettierPackageNames(pkg);
  pkg = stripListedDependencies(pkg, prettierNames);
  pkg = applyDprintPackageJsonCleanup(pkg);
  pkg = removeSimpleImportSortPackage(pkg);
  // DEPRECATED: remove legacy @finografic/oxfmt-config and ESLint stack
  pkg = removeLegacyOxfmtConfigPackage(pkg);
  pkg = removeEslintPackages(pkg);
  pkg = ensureOxcToolchainDevDependencies(pkg);
  pkg = applyOxfmtPackageJsonLayoutTransforms(pkg);

  return pkg;
}
