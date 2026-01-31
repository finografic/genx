/**
 * Markdown feature configuration.
 */

import { PKG_ESLINT_MARKDOWNLINT } from 'config/constants.config';

export const MARKDOWNLINT_PACKAGE = PKG_ESLINT_MARKDOWNLINT;
export const MARKDOWNLINT_PACKAGE_VERSION = 'latest';

/** VSCode extension ID for markdownlint */
export const MARKDOWNLINT_VSCODE_EXTENSION = 'davidanson.vscode-markdownlint';

/** VSCode settings key for markdownlint config */
export const MARKDOWNLINT_CONFIG_KEY = 'markdownlint.config';

/**
 * VSCode settings for markdown language.
 */
export const MARKDOWN_VSCODE_SETTINGS = {
  '[markdown]': {
    'editor.defaultFormatter': 'dprint.dprint',
    'files.trimTrailingWhitespace': false,
    'files.insertFinalNewline': true,
    'editor.codeActionsOnSave': {
      'source.fixAll.eslint': 'explicit',
    },
  },
  'markdownlint.config': {
    'default': true,
    'MD025': false, // Allow multiple top-level headings (useful for TODO files)
    'MD041': false, // Don't require first line to be a top-level heading
  },
} as const;

/**
 * ESLint markdown config block to add to eslint.config.ts.
 * This is the string representation that will be inserted.
 */
export const ESLINT_MARKDOWN_IMPORTS = `import markdownlintPlugin from 'eslint-plugin-markdownlint';
import markdownlintParser from 'eslint-plugin-markdownlint/parser.js';`;

export const ESLINT_MARKDOWN_CONFIG_BLOCK = `
  {
    files: ['**/*.md'],
    ignores: [
      'node_modules/**',
      'dist/**',
      '.cursor/chat/**',
      '.github/instructions/**',
    ],
    languageOptions: {
      parser: markdownlintParser,
    },
    plugins: {
      markdownlint: markdownlintPlugin as Linter.Processor,
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
      'markdownlint/md036': 'off', // No emphasis as heading
      'markdownlint/md040': 'off', // Fenced code language
      'markdownlint/md041': 'off', // First line heading
      'markdownlint/md043': 'off', // Required heading structure

      // Formatting consistency
      'stylistic/no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0, maxBOF: 0 }],
      'stylistic/no-trailing-spaces': 'error',
      'stylistic/no-multi-spaces': ['error', { exceptions: { Property: true } }],
    },
  },`;
