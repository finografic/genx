import { readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  fileExists,
  isDependencyDeclared,
  readExtensionsJson,
  removeDependency,
  replaceDprintLanguageFormatters,
  removeRootKeysWithPrefix,
  writeExtensionsJson,
} from 'utils';

import { PACKAGE_JSON } from 'config/constants.config';
import type { PackageJson } from 'types/package-json.types';
import { DPRINT_CONFIG_FILES, DPRINT_PACKAGES, OXFMT_FORMATTER_ID } from './oxfmt.constants';

const DPRINT_EXT_ID = 'dprint.dprint';

async function dprintDepsDeclared(targetDir: string): Promise<boolean> {
  for (const pkg of DPRINT_PACKAGES) {
    if (await isDependencyDeclared(targetDir, pkg)) return true;
  }
  return false;
}

function hasDprintConfigFiles(targetDir: string): boolean {
  return DPRINT_CONFIG_FILES.some((f) => fileExists(resolve(targetDir, f)));
}

/**
 * Whether the project still uses the legacy formatter stack (deps and/or config files).
 */
export async function isDprintPresent(targetDir: string): Promise<boolean> {
  if (hasDprintConfigFiles(targetDir)) return true;
  return dprintDepsDeclared(targetDir);
}

function stripDprintFromLintStaged(lintStaged: Record<string, string[] | string>): boolean {
  let modified = false;
  for (const key of [...Object.keys(lintStaged)]) {
    const cmds = lintStaged[key];
    if (Array.isArray(cmds)) {
      const next = cmds.filter((c) => !c.includes('dprint'));
      if (next.length !== cmds.length) {
        modified = true;
        if (next.length === 0) {
          delete lintStaged[key];
        } else {
          lintStaged[key] = next;
        }
      }
    } else if (typeof cmds === 'string' && cmds.includes('dprint')) {
      delete lintStaged[key];
      modified = true;
    }
  }
  return modified;
}

function stripDprintFromScripts(scripts: Record<string, string>): boolean {
  let modified = false;
  for (const key of [...Object.keys(scripts)]) {
    const value = scripts[key];
    if (key === 'update.dprint-config' || (typeof value === 'string' && value.includes('dprint'))) {
      delete scripts[key];
      modified = true;
    }
  }
  return modified;
}

/**
 * Uninstall legacy formatter packages, delete config files, and scrub package.json / VS Code metadata.
 */
export async function removeDprintIfPresent(targetDir: string): Promise<{ applied: string[] }> {
  const applied: string[] = [];

  const present = await isDprintPresent(targetDir);
  if (!present) {
    return { applied };
  }

  for (const pkg of DPRINT_PACKAGES) {
    const result = await removeDependency(targetDir, pkg);
    if (result.removed) {
      applied.push(`removed dependency ${pkg}`);
    }
  }

  for (const file of DPRINT_CONFIG_FILES) {
    const filePath = resolve(targetDir, file);
    if (fileExists(filePath)) {
      await unlink(filePath);
      applied.push(`removed ${file}`);
    }
  }

  const packageJsonPath = resolve(targetDir, PACKAGE_JSON);
  const rawPkg = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(rawPkg) as PackageJson;
  let pkgModified = false;

  if (packageJson['lint-staged'] && typeof packageJson['lint-staged'] === 'object') {
    const ls = packageJson['lint-staged'] as Record<string, string[] | string>;
    if (stripDprintFromLintStaged(ls)) {
      pkgModified = true;
      applied.push('lint-staged (removed dprint commands)');
    }
  }

  if (packageJson.scripts && stripDprintFromScripts(packageJson.scripts)) {
    pkgModified = true;
    applied.push('scripts (removed dprint-related entries)');
  }

  if (pkgModified) {
    await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  }

  const settingsPath = resolve(targetDir, '.vscode', 'settings.json');
  if (fileExists(settingsPath)) {
    let raw = await readFile(settingsPath, 'utf8');
    const r1 = removeRootKeysWithPrefix(raw, 'dprint.');
    raw = r1.text;
    const r2 = replaceDprintLanguageFormatters(raw, OXFMT_FORMATTER_ID);
    raw = r2.text;
    if (r1.changed || r2.changed) {
      await writeFile(settingsPath, raw, 'utf8');
      applied.push('.vscode/settings.json (removed dprint formatter / keys)');
    }
  }

  const extPath = resolve(targetDir, '.vscode', 'extensions.json');
  if (fileExists(extPath)) {
    const extJson = await readExtensionsJson(targetDir);
    if (extJson.recommendations?.includes(DPRINT_EXT_ID)) {
      extJson.recommendations = extJson.recommendations.filter((id) => id !== DPRINT_EXT_ID);
      await writeExtensionsJson(targetDir, extJson);
      applied.push('.vscode/extensions.json (removed dprint extension recommendation)');
    }
  }

  return { applied };
}
