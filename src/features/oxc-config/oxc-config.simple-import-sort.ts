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
