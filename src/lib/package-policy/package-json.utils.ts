import { readFile, writeFile } from 'node:fs/promises';

import { upgradeConfig } from 'config/upgrade.config';
import type { PackageJson } from 'types/package-json.types';

export interface PackageAuthor {
  name: string;
  email: string;
}

/** `Name <email> (url)` — npm's string form. Email and url are both optional. */
const AUTHOR_STRING = /^\s*([^<(]*?)\s*(?:<([^>]*)>)?\s*(?:\([^)]*\))?\s*$/;

/**
 * Read `author` from a package.json in either npm form — the `{ name, email }` object or the
 * `Name <email> (url)` string.
 *
 * Returns empty strings when absent, which callers must treat as "unknown" rather than
 * substituting: a LICENSE whose copyright line names nobody is worse than no LICENSE at all.
 */
export function parsePackageAuthor(packageJson: PackageJson): PackageAuthor {
  const { author } = packageJson;

  if (typeof author === 'string') {
    const match = AUTHOR_STRING.exec(author);
    return { name: match?.[1] ?? '', email: match?.[2] ?? '' };
  }

  if (typeof author === 'object' && author !== null) {
    const { name, email } = author as { name?: unknown; email?: unknown };
    return {
      name: typeof name === 'string' ? name : '',
      email: typeof email === 'string' ? email : '',
    };
  }

  return { name: '', email: '' };
}

function ensureKeyword(keywords: string[], keyword: string): { keywords: string[]; changed: boolean } {
  if (keywords.some((k) => k.toLowerCase() === keyword.toLowerCase())) {
    return { keywords, changed: false };
  }
  return { keywords: [...keywords, keyword], changed: true };
}

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

/**
 * Bring a package.json into line with the canonical set.
 *
 * **Ensure, not enforce.** A key the target already defines is left exactly as it is; only missing
 * keys are added. Overwriting on difference is what replaced `prepare: "husky && pnpm panda:codegen"`
 * with a bare `"husky"`, dropped `format:check` out of a project's `release:check`, and swapped
 * `md-lint` out of the markdown lint-staged entry — each time silently, and each time destroying a
 * deliberate project decision to restate a default.
 *
 * The trade-off is real and accepted: a script that genuinely has gone stale is no longer corrected
 * automatically. Deleting the key and re-running restores the canonical value.
 */
export function patchPackageJson(
  packageJson: PackageJson,
  packageNameWithoutScope: string,
): { packageJson: PackageJson; changes: string[] } {
  const changes: string[] = [];
  const next: PackageJson = { ...packageJson };

  // scripts
  const scripts = { ...packageJson.scripts };
  for (const [key, value] of Object.entries(upgradeConfig.packageJson.ensureScripts)) {
    if (scripts[key] === undefined) {
      scripts[key] = value;
      changes.push(`scripts.${key}`);
    }
  }
  next.scripts = scripts;

  // lint-staged
  const lintStaged = { ...packageJson['lint-staged'] };
  for (const [pattern, s] of Object.entries(upgradeConfig.packageJson.ensureLintStaged)) {
    if (lintStaged[pattern] === undefined) {
      lintStaged[pattern] = s;
      changes.push(`lint-staged.${pattern}`);
    }
  }
  next['lint-staged'] = lintStaged;

  // keywords
  const keywordRaw = packageJson.keywords;
  const keywords = Array.isArray(keywordRaw) ? keywordRaw.filter((k) => typeof k === 'string') : [];
  let changedKeywords = false;

  const { includeFinograficKeyword } = upgradeConfig.packageJson.ensureKeywords;
  const finograficKeywordResult = ensureKeyword(keywords, includeFinograficKeyword);
  changedKeywords = changedKeywords || finograficKeywordResult.changed;

  let updated = finograficKeywordResult.keywords;
  if (upgradeConfig.packageJson.ensureKeywords.includePackageName) {
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
