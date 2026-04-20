import { readFile, writeFile } from 'node:fs/promises';

import { ensureKeyword } from 'lib/migrate/migrate-metadata.utils';
import { migrateConfig } from 'config/migrate.config';
import type { PackageJson } from 'types/package-json.types';

/**
 * Keep `lint-staged` and `simple-git-hooks` at the end of package.json (repo convention).
 */
export function reorderGitHookTailKeys(packageJson: PackageJson): PackageJson {
  const { 'lint-staged': lintStaged, 'simple-git-hooks': simpleGitHooks, ...rest } = packageJson;

  return {
    ...rest,
    ...(lintStaged !== undefined ? { 'lint-staged': lintStaged } : {}),
    ...(simpleGitHooks !== undefined ? { 'simple-git-hooks': simpleGitHooks } : {}),
  };
}

export async function readPackageJson(path: string): Promise<PackageJson> {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw) as PackageJson;
}

/**
 * Remove top-level `commitlint` from a parsed package.json — config belongs in `commitlint.config.mjs`.
 */
export function stripInlinedCommitlintFromPackageJson(packageJson: PackageJson): {
  packageJson: PackageJson;
  changed: boolean;
} {
  if (!('commitlint' in packageJson)) {
    return { packageJson, changed: false };
  }
  const next: PackageJson = { ...packageJson };
  delete next['commitlint'];
  return { packageJson: next, changed: true };
}

export function patchPackageJson(
  packageJson: PackageJson,
  packageNameWithoutScope: string,
): { packageJson: PackageJson; changes: string[] } {
  const changes: string[] = [];
  const next: PackageJson = { ...packageJson };

  // scripts
  const scripts = { ...packageJson.scripts };
  for (const [key, value] of Object.entries(migrateConfig.packageJson.ensureScripts)) {
    if (scripts[key] !== value) {
      scripts[key] = value;
      changes.push(`scripts.${key}`);
    }
  }
  next.scripts = scripts;

  // lint-staged
  const lintStaged = { ...packageJson['lint-staged'] };
  for (const [pattern, commands] of Object.entries(migrateConfig.packageJson.ensureLintStaged)) {
    const current = lintStaged[pattern];
    if (!Array.isArray(current) || current.join('\n') !== commands.join('\n')) {
      lintStaged[pattern] = commands;
      changes.push(`lint-staged.${pattern}`);
    }
  }
  next['lint-staged'] = lintStaged;

  // keywords
  const keywordRaw = packageJson.keywords;
  const keywords = Array.isArray(keywordRaw)
    ? (keywordRaw.filter((k) => typeof k === 'string') as string[])
    : [];
  let changedKeywords = false;

  const { includeFinograficKeyword } = migrateConfig.packageJson.ensureKeywords;
  const finograficKeywordResult = ensureKeyword(keywords, includeFinograficKeyword);
  changedKeywords = changedKeywords || finograficKeywordResult.changed;

  let updated = finograficKeywordResult.keywords;
  if (migrateConfig.packageJson.ensureKeywords.includePackageName) {
    const packageNameKeywordResult = ensureKeyword(updated, packageNameWithoutScope);
    updated = packageNameKeywordResult.keywords;
    changedKeywords = changedKeywords || packageNameKeywordResult.changed;
  }

  if (changedKeywords) {
    next.keywords = updated;
    changes.push('keywords');
  }

  const stripped = stripInlinedCommitlintFromPackageJson(next);
  if (stripped.changed) {
    changes.push('commitlint (removed; use commitlint.config.mjs)');
    return { packageJson: reorderGitHookTailKeys(stripped.packageJson), changes };
  }

  return { packageJson: next, changes };
}

export async function writePackageJson(path: string, packageJson: PackageJson): Promise<void> {
  const formatted = `${JSON.stringify(packageJson, null, 2)}\n`;
  await writeFile(path, formatted, 'utf8');
}

/**
 * Read package.json, strip inlined `commitlint` if present, and write back when changed.
 * Used when migrate runs the hooks section without the package-json section (`--only=hooks`).
 */
export async function stripCommitlintFromPackageJsonFile(packageJsonPath: string): Promise<boolean> {
  const packageJson = await readPackageJson(packageJsonPath);
  const { packageJson: next, changed } = stripInlinedCommitlintFromPackageJson(packageJson);
  if (!changed) {
    return false;
  }
  await writePackageJson(packageJsonPath, reorderGitHookTailKeys(next));
  return true;
}
