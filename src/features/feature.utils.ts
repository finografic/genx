import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileExists } from 'utils';

import type { TemplateVars } from 'types/template.types';

/**
 * Build the default template variable set used when copying feature templates.
 * All string vars default to empty; YEAR is computed at call time.
 */
export function createDefaultTemplateVars(): TemplateVars {
  return {
    SCOPE: '',
    NAME: '',
    PACKAGE_NAME: '',
    YEAR: new Date().getFullYear().toString(),
    DESCRIPTION: '',
    AUTHOR_NAME: '',
    AUTHOR_EMAIL: '',
  };
}

/**
 * Insert missing ESLint ignore patterns into flat-config source (preview / apply).
 * Returns unchanged `content` when nothing is added.
 */
export function proposeEslintIgnorePatterns(content: string, patterns: readonly string[]): string {
  const missing = patterns.filter((p) => !content.includes(`'${p}'`));
  if (missing.length === 0) return content;

  let next = content;
  for (const pattern of missing) {
    if (/globalIgnores\s*\(\s*\[/.test(next)) {
      next = next.replace(/(globalIgnores\s*\(\s*\[[\s\S]*?)(\s*\]\s*\)\s*,)/, `$1    '${pattern}',\n$2`);
    } else {
      next = next.replace(/(ignores:\s*\[[^\]]*)\]/, `$1, '${pattern}']`);
    }
  }
  return next;
}

/**
 * Add ESLint ignore patterns to `globalIgnores([...])` when present, otherwise the
 * first legacy `ignores: [...]` block. Skips patterns already present.
 */
export async function addEslintIgnorePatterns(
  targetDir: string,
  patterns: readonly string[],
): Promise<string[]> {
  const eslintConfigPath = resolve(targetDir, 'eslint.config.ts');
  if (!fileExists(eslintConfigPath)) return [];

  const before = await readFile(eslintConfigPath, 'utf8');
  const missing = patterns.filter((p) => !before.includes(`'${p}'`));
  if (missing.length === 0) return [];

  const after = proposeEslintIgnorePatterns(before, patterns);
  await writeFile(eslintConfigPath, after, 'utf8');
  return [...missing];
}
