// NOTE: Shared constants used across create/migrate/features flows.

// ─────────────────────────────────────────────────────────────────────────────
// Filenames
// ─────────────────────────────────────────────────────────────────────────────

export const PACKAGE_JSON = 'package.json';

export const ESLINT_CONFIG_FILES = [
  'eslint.config.ts',
  'eslint.config.mjs',
  'eslint.config.cjs',
  'eslint.config.js',
] as const;

export const VSCODE_DIR = '.vscode';
export const VSCODE_SETTINGS_JSON = 'settings.json';
export const VSCODE_EXTENSIONS_JSON = 'extensions.json';
export const VSCODE_MARKDOWN_CSS = 'markdown-custom.css';

export const COMMITLINT_CONFIG = 'commitlint.config.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// Package names
// ─────────────────────────────────────────────────────────────────────────────

export const PKG_ESLINT_MARKDOWNLINT = 'eslint-plugin-markdownlint';
export const PKG_COMMITLINT_CLI = '@commitlint/cli';
export const PKG_COMMITLINT_CONFIG = '@commitlint/config-conventional';
export const PKG_LINT_STAGED = 'lint-staged';
export const PKG_SIMPLE_GIT_HOOKS = 'simple-git-hooks';

// ─────────────────────────────────────────────────────────────────────────────
// package.json scripts formatting
// ─────────────────────────────────────────────────────────────────────────────

export const PACKAGE_JSON_SCRIPTS_SECTION_PREFIX = '·'.repeat(10);
export const PACKAGE_JSON_SCRIPTS_SECTION_DIVIDER = '·'.repeat(50);
