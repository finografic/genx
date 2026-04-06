import { describe, expect, it } from 'vitest';

import { stripSimpleImportSortFromEslintConfigContent } from './oxfmt.simple-import-sort';

const WITH_SIMPLE_IMPORT_SORT = `import js from '@eslint/js';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';

export default [
  {
    rules: {
      // Import sorting
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            ['^node:'],
            ['^@finografic', '^@workspace'],
            ['^\\\\u0000'],
            ['^(?!@finografic)(?!@workspace)@?[a-z]'],
            [
              '^(lib|utils)',
              '^(types|constants|config)',
              '^\\\\.\\\\.(?!/?$)',
              '^\\\\.\\\\./?$',
              '^\\\\.\\\\./(?=.*/)(?!/?$)',
              '^\\\\.(?!/?$)',
              '^\\\\./?$',
            ],
          ],
        },
      ],
      'simple-import-sort/exports': 'error',
      'no-console': 'off',
    },
  },
];
`;

describe('stripSimpleImportSortFromEslintConfigContent', () => {
  it('removes default import, comment, rules, and leaves other rules', () => {
    const out = stripSimpleImportSortFromEslintConfigContent(WITH_SIMPLE_IMPORT_SORT);
    expect(out).not.toContain('simple-import-sort');
    expect(out).not.toContain('eslint-plugin-simple-import-sort');
    expect(out).toContain("'no-console': 'off'");
  });

  it('is idempotent', () => {
    const once = stripSimpleImportSortFromEslintConfigContent(WITH_SIMPLE_IMPORT_SORT);
    const twice = stripSimpleImportSortFromEslintConfigContent(once);
    expect(twice).toBe(once);
  });

  it('does not change config without the plugin', () => {
    const plain = `export default [{ rules: { 'no-console': 'off' } }];`;
    expect(stripSimpleImportSortFromEslintConfigContent(plain)).toBe(plain);
  });
});
