import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import type { Linter } from 'eslint';
import markdownlintPlugin from 'eslint-plugin-markdownlint';
import markdownlintParser from 'eslint-plugin-markdownlint/parser.js';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

// NOTE: ALL @typescript-eslint/eslint-plugin (over 100 rules))
// https://typescript-eslint.io/rules/
import tseslint from 'typescript-eslint';

const config: Linter.Config[] = [
  js.configs.recommended,
  // tseslint.configs.strictTypeChecked, // ref: https://typescript-eslint.io/getting-started/typed-linting
  // tseslint.configs.stylisticTypeChecked, // ref: https://typescript-eslint.io/getting-started/typed-linting

  {
    ignores: ['dist/**', 'node_modules/**', '.cursor/**'],
  },

  {
    files: ['**/*.ts', '**/*.tsx', './*.mjs'],
    languageOptions: {
      parser: tseslint.parser,
      // projectService: true, // ref: https://typescript-eslint.io/getting-started/typed-linting
      parserOptions: {
        // Enable typed linting when you want it
        // project: true,
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'simple-import-sort': simpleImportSort,
      stylistic: stylistic,
    },
    rules: {
      // Disable base rules in favor of TS-aware ones
      'no-unused-vars': 'off',
      'no-redeclare': 'off',
      'no-console': 'off',

      // TypeScript rules
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],

      '@typescript-eslint/no-redeclare': 'warn',

      // Stylistic
      'stylistic/semi': ['error'],
      'stylistic/quotes': ['error', 'single'],
      'stylistic/indent': ['error', 2, { SwitchCase: 1 }],
      'stylistic/no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0, maxBOF: 0 }],
      'stylistic/no-trailing-spaces': 'error',
      'stylistic/no-multi-spaces': ['error', { exceptions: { Property: true } }],
      'stylistic/object-curly-spacing': ['error', 'always'],
      'stylistic/comma-spacing': ['error', { before: false, after: true }],
      'stylistic/comma-dangle': ['error', 'always-multiline'],
      'stylistic/object-property-newline': ['error', { allowAllPropertiesOnSameLine: true }],
      'stylistic/arrow-spacing': ['error', { before: true, after: true }],
      'stylistic/type-annotation-spacing': ['error', {
        before: false,
        after: true,
        overrides: { arrow: { before: true, after: true } },
      }],

      // Import sorting
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            ['^node:'],
            ['^@finografic', '^@workspace'],
            ['^\\u0000'],
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
    languageOptions: {
      parser: markdownlintParser,
    },
    plugins: {
      markdownlint: markdownlintPlugin,
      stylistic: stylistic,
    },
    rules: {
      ...markdownlintPlugin.configs.recommended.rules,
      'markdownlint/md012': 'off', // Multiple consecutive blank lines
      'markdownlint/md013': 'off', // Line length
      'markdownlint/md024': 'off', // Duplicate headings
      'markdownlint/md025': 'off', // Single h1
      'markdownlint/md026': 'off', // Trailing punctuation in heading
      'markdownlint/md029': 'off', // List style
      'markdownlint/md036': 'off', // No mphasis as heading
      'markdownlint/md040': 'off', // Fenced code language
      'markdownlint/md041': 'off', // First line heading
      'markdownlint/md043': 'off', // Required heading structure

      // Formatting consistency
      'stylistic/no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0, maxBOF: 0 }],
      'stylistic/no-trailing-spaces': 'error',
      'stylistic/no-multi-spaces': ['error', { exceptions: { Property: true } }],
    },
  },
];

export default config;
