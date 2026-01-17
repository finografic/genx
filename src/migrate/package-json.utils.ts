import { readFile, writeFile } from 'node:fs/promises';

import { ensureKeyword } from 'src/migrate/migrate-metadata.utils';

import { migrateConfig } from 'config/migrate.config';
import type { PackageJson } from 'types/package-json.types';

export async function readPackageJson(path: string): Promise<PackageJson> {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw) as PackageJson;
}

export function patchPackageJson(
  packageJson: PackageJson,
  packageNameWithoutScope: string,
): { packageJson: PackageJson; changes: string[] } {
  const changes: string[] = [];
  const next: PackageJson = { ...packageJson };

  // scripts
  const scripts = { ...(packageJson.scripts ?? {}) };
  for (const [key, value] of Object.entries(migrateConfig.packageJson.ensureScripts)) {
    if (scripts[key] !== value) {
      scripts[key] = value;
      changes.push(`scripts.${key}`);
    }
  }
  next.scripts = scripts;

  // lint-staged
  const lintStaged = { ...(packageJson['lint-staged'] ?? {}) };
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

  const includeFinograficKeyword =
    migrateConfig.packageJson.ensureKeywords.includeFinograficKeyword;
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

  return { packageJson: next, changes };
}

export async function writePackageJson(path: string, packageJson: PackageJson): Promise<void> {
  const formatted = `${JSON.stringify(packageJson, null, 2)}\n`;
  await writeFile(path, formatted, 'utf8');
}
