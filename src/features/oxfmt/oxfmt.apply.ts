import { readFile, rename, writeFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { policy } from '@finografic/deps-policy';
import {
  errorMessage,
  fileExists,
  installDevDependency,
  isDependencyDeclared,
  removeDependency,
  spinner,
  successMessage,
  successRemovedMessage,
  successUpdatedMessage,
} from 'utils';
import type { FeatureApplyResult, FeatureContext } from '../feature.types';

import {
  ESLINT_CONFIG_FILES,
  PACKAGE_JSON,
  PACKAGE_JSON_SCRIPTS_SECTION_DIVIDER,
  PACKAGE_JSON_SCRIPTS_PACKAGES_SECTION,
  PACKAGE_JSON_SCRIPTS_SECTION_PREFIX,
} from 'config/constants.config';
import type { PackageJson } from 'types/package-json.types';
import {
  FORMATTING_SCRIPTS,
  FORMATTING_SECTION_TITLE,
  OXFMT_CI_STEP,
  OXFMT_CLI_PACKAGE,
  OXFMT_COVERED_STYLISTIC_RULES,
  OXFMT_CONFIG_PACKAGE,
  OXFMT_LINT_STAGED_CODE_PATTERN,
  OXFMT_LINT_STAGED_COMMAND,
  OXFMT_LINT_STAGED_DATA_PATTERN,
  OXFMT_LINT_STAGED_DATA_PATTERN_ALIASES,
  OXFMT_LINT_STAGED_MD_PATTERN,
  OXFMT_UPDATE_SCRIPT,
  PRETTIER_CONFIG_FILES,
  PRETTIER_PACKAGE_PATTERNS,
  PRETTIER_PACKAGES,
  SIMPLE_IMPORT_SORT_PACKAGE,
} from './oxfmt.constants';
import { removeDprintIfPresent } from './oxfmt.dprint-cleanup';
import { stripSimpleImportSortFromEslintConfig } from './oxfmt.simple-import-sort';
import { ensureOxfmtConfig } from './oxfmt.template';
import {
  applyOxfmtExtensions,
  applyOxfmtFormatterSettings,
  applyOxfmtSharedVSCodeSettings,
} from './oxfmt.vscode';
import { scrubDprintFromGithubWorkflows } from './oxfmt.workflows';

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

async function findPrettierPackages(targetDir: string): Promise<string[]> {
  const packageJsonPath = resolve(targetDir, PACKAGE_JSON);
  const raw = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(raw) as PackageJson;

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

async function replacePrettierIfPresent(
  targetDir: string,
): Promise<{ removedPackages: string[]; backedUp: string[] }> {
  const backedUp: string[] = [];
  const removedPackages: string[] = [];

  const prettierPackages = await findPrettierPackages(targetDir);
  for (const pkg of prettierPackages) {
    const result = await removeDependency(targetDir, pkg);
    if (result.removed) {
      removedPackages.push(pkg);
    }
  }

  for (const file of PRETTIER_CONFIG_FILES) {
    const filePath = resolve(targetDir, file);
    if (fileExists(filePath)) {
      const ext = extname(file);
      const base = basename(file, ext || undefined);
      const backupName = base + '--backup' + (ext || '');
      const backupPath = resolve(targetDir, backupName);
      await rename(filePath, backupPath);
      backedUp.push(file);
    }
  }

  return { removedPackages, backedUp };
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

/**
 * Place `update:oxfmt-config` in the PACKAGES scripts section (after `update:eslint-config` when present).
 */
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

/**
 * Move `format:check` / `format:fix` to immediately after the FORMATTING section divider when misplaced (e.g. above the divider).
 */
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

async function addFormattingScripts(packageJsonPath: string): Promise<{ added: boolean; changes: string[] }> {
  const raw = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(raw) as PackageJson;

  const scripts = { ...(packageJson.scripts ?? {}) };

  if (hasFormattingScripts(scripts)) {
    return { added: false, changes: [] };
  }

  const changes: string[] = [];
  const scriptKeys = Object.keys(scripts);
  const insertionPoint = findFormattingInsertionPoint(scripts);

  if (insertionPoint === -1) {
    return { added: false, changes: [] };
  }

  const newScripts: Record<string, string> = {};

  for (let i = 0; i < insertionPoint; i++) {
    const key = scriptKeys[i];
    newScripts[key] = scripts[key];
  }

  if (!hasFormattingSectionTitle(scripts)) {
    newScripts[FORMATTING_SECTION_TITLE] = PACKAGE_JSON_SCRIPTS_SECTION_DIVIDER;
    changes.push(`scripts.${FORMATTING_SECTION_TITLE}`);
  }

  for (const [scriptKey, scriptValue] of Object.entries(FORMATTING_SCRIPTS)) {
    newScripts[scriptKey] = scriptValue;
    changes.push(`scripts.${scriptKey}`);
  }

  for (let i = insertionPoint; i < scriptKeys.length; i++) {
    const key = scriptKeys[i];
    newScripts[key] = scripts[key];
  }

  packageJson.scripts = newScripts;

  const formatted = `${JSON.stringify(packageJson, null, 2)}\n`;
  await writeFile(packageJsonPath, formatted, 'utf8');

  return { added: changes.length > 0, changes };
}

async function ensureFormattingScriptsPlacement(packageJsonPath: string): Promise<boolean> {
  const raw = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(raw) as PackageJson;
  const { next, changed } = ensureFormattingScriptsUnderFormattingHeader(packageJson.scripts ?? {});
  if (!changed) return false;
  packageJson.scripts = next;
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  return true;
}

async function addUpdateScript(packageJsonPath: string): Promise<boolean> {
  const raw = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(raw) as PackageJson;

  const scripts = packageJson.scripts ?? {};
  const { next, changed } = ensureUpdateOxfmtScriptPlacement(scripts);
  if (!changed) return false;

  packageJson.scripts = next;
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  return true;
}

async function addFormatToReleaseCheck(packageJsonPath: string): Promise<boolean> {
  const raw = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(raw) as PackageJson;

  const scripts = packageJson.scripts ?? {};
  const releaseCheck = scripts['release:check'];
  if (!releaseCheck || releaseCheck.includes('format:check')) return false;

  scripts['release:check'] = `pnpm format:check && ${releaseCheck}`;
  packageJson.scripts = scripts;

  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  return true;
}

async function addOxfmtToLintStaged(packageJsonPath: string): Promise<boolean> {
  const raw = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(raw) as PackageJson;

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

  if (before === JSON.stringify(reordered)) return false;

  packageJson['lint-staged'] = reordered as Record<string, string[]>;
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  return true;
}

async function addFormatCheckToCI(targetDir: string): Promise<boolean> {
  const ciPath = resolve(targetDir, '.github/workflows/ci.yml');
  if (!fileExists(ciPath)) return false;

  const content = await readFile(ciPath, 'utf8');
  if (
    content.includes('oxfmt --check') ||
    content.includes('pnpm format:check') ||
    content.includes('format:check')
  )
    return false;

  const updated = content.trimEnd() + OXFMT_CI_STEP;
  await writeFile(ciPath, updated, 'utf8');
  return true;
}

async function stripFormattingStylisticRules(targetDir: string): Promise<boolean> {
  let eslintConfigPath: string | null = null;
  for (const candidate of ESLINT_CONFIG_FILES) {
    const filePath = resolve(targetDir, candidate);
    if (fileExists(filePath)) {
      eslintConfigPath = filePath;
      break;
    }
  }

  if (!eslintConfigPath) return false;

  const content = await readFile(eslintConfigPath, 'utf8');
  let updated = content;

  for (const rule of OXFMT_COVERED_STYLISTIC_RULES) {
    const escaped = rule.replace(/\//g, '\\/');
    const regex = new RegExp(`^\\s*'${escaped}':.+\\n`, 'gm');
    updated = updated.replace(regex, '');
  }

  updated = updated.replace(/^\s*\/\/ Stylistic\n/gm, '');
  updated = updated.replace(/\n{3,}/g, '\n\n');

  if (updated !== content) {
    await writeFile(eslintConfigPath, updated, 'utf8');
    return true;
  }

  return false;
}

/**
 * Apply oxfmt to an existing package (Prettier → oxfmt migration path).
 */
export async function applyOxfmt(context: FeatureContext): Promise<FeatureApplyResult> {
  const applied: string[] = [];

  const replaceResult = await replacePrettierIfPresent(context.targetDir);
  if (replaceResult.removedPackages.length > 0) {
    applied.push('removed Prettier packages');
    successMessage(`Uninstalled: ${replaceResult.removedPackages.join(', ')}`);
  }
  if (replaceResult.backedUp.length > 0) {
    applied.push('backed up Prettier config(s)');
    successMessage(`Backed up Prettier config: ${replaceResult.backedUp.join(', ')}`);
  }

  const dprintCleanup = await removeDprintIfPresent(context.targetDir);
  if (dprintCleanup.applied.length > 0) {
    applied.push(...dprintCleanup.applied);
    successRemovedMessage('Removed legacy formatter (dprint) from project');
  }

  try {
    const dev = policy.base.devDependencies ?? {};
    for (const [pkg, version] of [
      [OXFMT_CLI_PACKAGE, dev['oxfmt']],
      [OXFMT_CONFIG_PACKAGE, dev['@finografic/oxfmt-config']],
    ] as const) {
      const alreadyDeclared = await isDependencyDeclared(context.targetDir, pkg);
      if (!alreadyDeclared) {
        const installSpin = spinner();
        installSpin.start(`Installing ${pkg}...`);
        const installResult = await installDevDependency(context.targetDir, pkg, version);
        installSpin.stop(installResult.installed ? `Installed ${pkg}` : `${pkg} already installed`);
        if (installResult.installed) {
          applied.push(pkg);
        }
      }
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error('Unknown error');
    errorMessage(error.message);
    return { applied, error };
  }

  const configResult = await ensureOxfmtConfig(context.targetDir);
  if (configResult.wrote) {
    applied.push('oxfmt.config.ts');
    successMessage('Created oxfmt.config.ts');
  }

  const packageJsonPath = resolve(context.targetDir, PACKAGE_JSON);
  const scriptsResult = await addFormattingScripts(packageJsonPath);
  if (scriptsResult.added) {
    applied.push('formatting scripts');
    successMessage('Added formatting scripts to package.json');
  }

  const formatScriptsMoved = await ensureFormattingScriptsPlacement(packageJsonPath);
  if (formatScriptsMoved) {
    applied.push('package.json (format scripts under FORMATTING section)');
    successMessage('Ensured format scripts are under the FORMATTING section');
  }

  const addedUpdateScript = await addUpdateScript(packageJsonPath);
  if (addedUpdateScript) {
    successMessage(`Added ${OXFMT_UPDATE_SCRIPT.key} script`);
  }

  const addedFormatToRelease = await addFormatToReleaseCheck(packageJsonPath);
  if (addedFormatToRelease) {
    successMessage('Added format:check to release:check script');
  }

  const addedToLintStaged = await addOxfmtToLintStaged(packageJsonPath);
  if (addedToLintStaged) {
    applied.push('lint-staged (oxfmt entries)');
    successMessage('Added oxfmt to lint-staged config');
  }

  const workflowScrub = await scrubDprintFromGithubWorkflows(context.targetDir);
  if (workflowScrub.applied.length > 0) {
    applied.push(...workflowScrub.applied);
    successUpdatedMessage('Updated GitHub workflows (dprint → pnpm format:check)');
  }

  const addedToCI = await addFormatCheckToCI(context.targetDir);
  if (addedToCI) {
    applied.push('ci.yml (format check step)');
    successMessage('Added format check step to CI workflow');
  }

  const addedExtensions = await applyOxfmtExtensions(context.targetDir);
  if (addedExtensions.length > 0) {
    applied.push('.vscode/extensions.json');
    successMessage(`Added extension recommendation: ${addedExtensions.join(', ')}`);
  }

  const settingsResult = await applyOxfmtFormatterSettings(context.targetDir);
  if (settingsResult.addedLanguages.length > 0 || settingsResult.disabledPrettier) {
    applied.push('.vscode/settings.json');
    if (settingsResult.disabledPrettier) {
      successMessage('Disabled Prettier in VSCode settings');
    }
    if (settingsResult.addedLanguages.length > 0) {
      successMessage(`Configured oxfmt for: ${settingsResult.addedLanguages.join(', ')}`);
    }
  }

  const sharedSettingsModified = await applyOxfmtSharedVSCodeSettings(context.targetDir);
  if (sharedSettingsModified) {
    if (!applied.includes('.vscode/settings.json')) {
      applied.push('.vscode/settings.json');
    }
    successMessage('Added oxfmt editor defaults to VSCode');
  }

  const strippedRules = await stripFormattingStylisticRules(context.targetDir);
  if (strippedRules) {
    applied.push('eslint.config.ts (removed oxfmt-covered stylistic rules)');
    successMessage('Removed redundant stylistic rules from ESLint config');
  }

  const strippedSimpleImportSort = await stripSimpleImportSortFromEslintConfig(context.targetDir);
  if (strippedSimpleImportSort) {
    applied.push('eslint.config (removed simple-import-sort)');
    successMessage('Removed eslint-plugin-simple-import-sort rules from ESLint config');
  }

  const simpleImportSortRemove = await removeDependency(context.targetDir, SIMPLE_IMPORT_SORT_PACKAGE);
  if (simpleImportSortRemove.removed) {
    applied.push(SIMPLE_IMPORT_SORT_PACKAGE);
    successMessage(`Uninstalled ${SIMPLE_IMPORT_SORT_PACKAGE}`);
  }

  if (applied.length === 0) {
    return { applied, noopMessage: 'oxfmt already installed. No changes made.' };
  }

  return { applied };
}
