import { readFile, rename, writeFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import {
  errorMessage,
  fileExists,
  installDevDependency,
  isDependencyDeclared,
  removeDependency,
  spinner,
  successMessage,
} from 'utils';
import type { FeatureApplyResult, FeatureContext } from '../feature.types';

import {
  ESLINT_CONFIG_FILES,
  PACKAGE_JSON,
  PACKAGE_JSON_SCRIPTS_SECTION_DIVIDER,
  PACKAGE_JSON_SCRIPTS_SECTION_PREFIX,
} from 'config/constants.config';
import type { PackageJson } from 'types/package-json.types';
import {
  FORMATTING_SCRIPTS,
  FORMATTING_SECTION_TITLE,
  OXFMT_CI_STEP,
  OXFMT_CLI_PACKAGE,
  OXFMT_CLI_VERSION,
  OXFMT_COVERED_STYLISTIC_RULES,
  OXFMT_CONFIG_PACKAGE,
  OXFMT_CONFIG_PACKAGE_VERSION,
  OXFMT_LINT_STAGED_CODE_PATTERN,
  OXFMT_LINT_STAGED_COMMAND,
  OXFMT_LINT_STAGED_DATA_PATTERN,
  OXFMT_UPDATE_SCRIPT,
  PRETTIER_CONFIG_FILES,
  PRETTIER_PACKAGE_PATTERNS,
  PRETTIER_PACKAGES,
} from './oxfmt.constants';
import { ensureOxfmtConfig } from './oxfmt.template';
import {
  applyOxfmtExtensions,
  applyOxfmtFormatterSettings,
  applyOxfmtSharedVSCodeSettings,
} from './oxfmt.vscode';

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

function hasFormattingScripts(scripts: Record<string, string>): boolean {
  return 'format' in scripts || 'format.check' in scripts;
}

function hasFormattingSectionTitle(scripts: Record<string, string>): boolean {
  return Object.keys(scripts).some((key) => key === FORMATTING_SECTION_TITLE);
}

function findFormattingInsertionPoint(scripts: Record<string, string>): number {
  if (hasFormattingScripts(scripts)) {
    return -1;
  }

  const scriptKeys = Object.keys(scripts);

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

async function addUpdateScript(packageJsonPath: string): Promise<boolean> {
  const raw = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(raw) as PackageJson;

  const scripts = packageJson.scripts ?? {};
  if (scripts[OXFMT_UPDATE_SCRIPT.key]) return false;

  scripts[OXFMT_UPDATE_SCRIPT.key] = OXFMT_UPDATE_SCRIPT.value;
  packageJson.scripts = scripts;

  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  return true;
}

async function addFormatToReleaseCheck(packageJsonPath: string): Promise<boolean> {
  const raw = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(raw) as PackageJson;

  const scripts = packageJson.scripts ?? {};
  const releaseCheck = scripts['release.check'];
  if (!releaseCheck || releaseCheck.includes('format.check')) return false;

  scripts['release.check'] = `pnpm format.check && ${releaseCheck}`;
  packageJson.scripts = scripts;

  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  return true;
}

async function addOxfmtToLintStaged(packageJsonPath: string): Promise<boolean> {
  const raw = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(raw) as PackageJson;

  const lintStaged = (packageJson['lint-staged'] ?? {}) as Record<string, string[]>;
  let modified = false;

  const codePattern = OXFMT_LINT_STAGED_CODE_PATTERN;
  const codeCommands = lintStaged[codePattern];
  if (!Array.isArray(codeCommands) || codeCommands.length === 0) {
    lintStaged[codePattern] = [OXFMT_LINT_STAGED_COMMAND, 'eslint --fix'];
    modified = true;
  } else if (!codeCommands.includes(OXFMT_LINT_STAGED_COMMAND)) {
    lintStaged[codePattern] = [OXFMT_LINT_STAGED_COMMAND, ...codeCommands];
    modified = true;
  }

  if (!lintStaged[OXFMT_LINT_STAGED_DATA_PATTERN]) {
    lintStaged[OXFMT_LINT_STAGED_DATA_PATTERN] = [OXFMT_LINT_STAGED_COMMAND];
    modified = true;
  }

  if (modified) {
    packageJson['lint-staged'] = lintStaged;
    await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  }

  return modified;
}

async function addFormatCheckToCI(targetDir: string): Promise<boolean> {
  const ciPath = resolve(targetDir, '.github/workflows/ci.yml');
  if (!fileExists(ciPath)) return false;

  const content = await readFile(ciPath, 'utf8');
  if (
    content.includes('oxfmt --check') ||
    content.includes('pnpm format.check') ||
    content.includes('format.check')
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

  try {
    for (const [pkg, version] of [
      [OXFMT_CLI_PACKAGE, OXFMT_CLI_VERSION],
      [OXFMT_CONFIG_PACKAGE, OXFMT_CONFIG_PACKAGE_VERSION],
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

  const addedUpdateScript = await addUpdateScript(packageJsonPath);
  if (addedUpdateScript) {
    successMessage(`Added ${OXFMT_UPDATE_SCRIPT.key} script`);
  }

  const addedFormatToRelease = await addFormatToReleaseCheck(packageJsonPath);
  if (addedFormatToRelease) {
    successMessage('Added format.check to release.check script');
  }

  const addedToLintStaged = await addOxfmtToLintStaged(packageJsonPath);
  if (addedToLintStaged) {
    applied.push('lint-staged (oxfmt entries)');
    successMessage('Added oxfmt to lint-staged config');
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

  if (applied.length === 0) {
    return { applied, noopMessage: 'oxfmt already installed. No changes made.' };
  }

  return { applied };
}
