import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileExists } from 'utils';

import { ESLINT_CONFIG_FILES } from 'config/constants.config';

import { SIMPLE_IMPORT_SORT_PACKAGE } from './oxc-config.constants';

/**
 * Strip `eslint-plugin-simple-import-sort` usage from an ESLint flat-config file body. Import sort is handled
 * by oxfmt; keeping the plugin causes duplicate/conflicting concerns.
 */
export function stripSimpleImportSortFromEslintConfigContent(content: string): string {
  let s = content;

  s = s.replace(/^import\s+[\w$]+\s+from\s+['"]eslint-plugin-simple-import-sort['"]\s*;?\s*$/gim, '');
  s = s.replace(
    /^import\s+\*\s+as\s+[\w$]+\s+from\s+['"]eslint-plugin-simple-import-sort['"]\s*;?\s*$/gim,
    '',
  );

  s = s.replace(/\s*['"]simple-import-sort['"]\s*:\s*[\w$]+\s*,?\s*\r?\n/g, '\n');

  s = s.replace(/\s*\/\/\s*Import sorting\s*\r?\n/g, '\n');

  s = s.replace(
    /\s*['"]simple-import-sort\/imports['"]\s*:\s*\[\s*['"]error['"]\s*,\s*\{[\s\S]*?\}\s*,\s*\]\s*,?/g,
    '',
  );

  s = s.replace(/\s*['"]simple-import-sort\/exports['"]\s*:\s*['"][^'"]+['"]\s*,?/g, '');

  s = s.replace(/\n{3,}/g, '\n\n');
  return s;
}

/**
 * Apply {@link stripSimpleImportSortFromEslintConfigContent} to the first existing `eslint.config.*` under
 * `targetDir` that references simple-import-sort.
 */
export async function stripSimpleImportSortFromEslintConfig(targetDir: string): Promise<boolean> {
  let changed = false;

  for (const name of ESLINT_CONFIG_FILES) {
    const filePath = resolve(targetDir, name);
    if (!fileExists(filePath)) continue;

    const raw = await readFile(filePath, 'utf8');
    if (!raw.includes('simple-import-sort') && !raw.includes(SIMPLE_IMPORT_SORT_PACKAGE)) {
      continue;
    }

    const next = stripSimpleImportSortFromEslintConfigContent(raw);
    if (next === raw) continue;

    await writeFile(filePath, `${next.endsWith('\n') ? next : `${next}\n`}`, 'utf8');
    changed = true;
  }

  return changed;
}
