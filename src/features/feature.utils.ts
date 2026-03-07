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
 * Add ESLint ignore patterns to the first `ignores: [...]` block in eslint.config.ts.
 * Skips patterns already present. Returns the list of patterns actually added.
 */
export async function addEslintIgnorePatterns(
  targetDir: string,
  patterns: readonly string[],
): Promise<string[]> {
  const eslintConfigPath = resolve(targetDir, 'eslint.config.ts');
  if (!fileExists(eslintConfigPath)) return [];

  let content = await readFile(eslintConfigPath, 'utf8');

  const missing = patterns.filter((p) => !content.includes(`'${p}'`));
  if (missing.length === 0) return [];

  for (const pattern of missing) {
    content = content.replace(/(ignores:\s*\[[^\]]*)\]/, `$1, '${pattern}']`);
  }

  await writeFile(eslintConfigPath, content, 'utf8');
  return [...missing];
}
