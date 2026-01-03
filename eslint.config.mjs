import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import markdownlintPlugin from "eslint-plugin-markdownlint";
import markdownlintParser from "eslint-plugin-markdownlint/parser.js";
import simpleImportSort from 'eslint-plugin-simple-import-sort';

export default [
  js.configs.recommended,

  {
    ignores: ['dist/**', 'node_modules/**'],
  },

  {
    files: ['**/*.ts', '**/*.tsx', './*.ts', './*.mjs'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'simple-import-sort': simpleImportSort,
      'stylistic': stylistic,
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': 'off',
      'no-redeclare': 'off',
      'stylistic/semi': 'error',
      'stylistic/indent': ['error', 2, { SwitchCase: 1 }],
      'stylistic/no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0, maxBOF: 0 }],
      'stylistic/no-trailing-spaces': 'error',
      'stylistic/no-multi-spaces': ['error', { exceptions: { Property: true } }],
      'stylistic/object-curly-spacing': ['error', 'always'],

      '@typescript-eslint/no-console':'off',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-redeclare': 'warn',

      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            ['^node:'],
            ['^@finografic', '^@workspace'],
            ['^\\u0000'],
            // External packages (e.g. `execa`, `picocolors`, `@types/*`)
            ['^(?!@finografic)(?!@workspace)@?[a-z]'],
            [
              '^(lib|utils)',
              '^(types|constants|config)',
              '^\\.\\.(?!/?$)',
              '^\\.\\./?$',
              '^\\./(?=.*/)(?!/?$)',
              '^\\.(?!/?$)',
              '^\\./?$',
            ],
          ],
        },
      ],
      'simple-import-sort/exports': 'error',
    },
  },

  {
    files: ['**/*.md'],
    ignores: [
      'node_modules/**',
      'dist/**',
      '.cursor/chat/**',
      '.github/instructions/**',
      '!templates/**',
    ],
    plugins: {
      'markdownlint': markdownlintPlugin,
      'stylistic': stylistic,
    },
    languageOptions: {
      parser: markdownlintParser
    },
    rules: {
      ...markdownlintPlugin.configs.recommended.rules,
      "markdownlint/md012": "off", // Line length
      "markdownlint/md013": "off", // Line length
      "markdownlint/md024": "off", // Duplicate headings
      "markdownlint/md025": "off", // Single h1
      "markdownlint/md040": "off", // Fenced code language
      "markdownlint/md041": "off", // First line heading
      "markdownlint/md043": "off", // Required heading structure
      'stylistic/no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0, maxBOF: 0 }],
      'stylistic/no-trailing-spaces': 'error',
      'stylistic/no-multi-spaces': ['error', { exceptions: { Property: true } }],
    }
  }
];
