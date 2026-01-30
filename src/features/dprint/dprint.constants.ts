/**
 * dprint feature configuration.
 *
 * DPRINT_PACKAGE_VERSION is used when the feature adds the dep (installs @latest).
 * Template (templates/package/package.json) and dependency rules use ^0.8.0;
 * bump those when releasing a new @finografic/dprint-config.
 *
 * PRETTIER_* are used when replacing Prettier with dprint: detect Prettier, uninstall
 * the package, and backup Prettier config files before applying dprint.
 */

export const DPRINT_PACKAGE = '@finografic/dprint-config';
export const DPRINT_PACKAGE_VERSION = 'latest';

/** VSCode extension ID for dprint */
export const DPRINT_VSCODE_EXTENSION = 'dprint.dprint';

/**
 * Exact Prettier-related package names to uninstall when replacing with dprint.
 */
export const PRETTIER_PACKAGES = [
  'prettier',
  'eslint-config-prettier',
  'eslint-plugin-prettier',
] as const;

/**
 * Glob patterns to match Prettier-related packages (e.g., "*prettier-plugin-*").
 * Patterns use simple wildcards: * matches any characters.
 * For scoped packages like @scope/name, the pattern matches against the full name.
 */
export const PRETTIER_PACKAGE_PATTERNS = [
  '*prettier-plugin-*',
] as const;

/** Prettier config filenames to detect and backup when replacing with dprint. */
export const PRETTIER_CONFIG_FILES = [
  '.prettierrc',
  '.prettierrc.js',
  '.prettierrc.json',
  'prettier.config.js',
  'prettier.config.cjs',
  'prettier.config.mjs',
  'prettier.config.ts',
] as const;

export const FORMATTING_SECTION_TITLE = '·········· FORMATTING';
export const FORMATTING_SCRIPTS = {
  format: 'dprint fmt --diff',
  'format.check': 'dprint check',
};

/**
 * Language categories for dprint VSCode settings.
 * Each category contains language IDs that should use dprint as the default formatter.
 */
export const DPRINT_LANGUAGE_CATEGORIES = {
  /** Base languages - always included */
  DEFAULT: ['javascript', 'json', 'jsonc'] as const,
  /** TypeScript - included when typescript is a dependency */
  TYPESCRIPT: ['typescript'] as const,
  /** React/Frontend - included when react is a dependency */
  REACT: ['typescriptreact', 'javascriptreact', 'css', 'scss', 'html'] as const,
  /** Markdown - always included (commonly used) */
  MARKDOWN: ['markdown'] as const,
  /** Data formats - always included (commonly used in configs) */
  DATA: ['yaml', 'toml'] as const,
} as const;

/** Type for language category keys */
export type DprintLanguageCategory = keyof typeof DPRINT_LANGUAGE_CATEGORIES;

/**
 * Dependencies that trigger inclusion of specific language categories.
 */
export const DPRINT_CATEGORY_DEPENDENCIES: Record<DprintLanguageCategory, string[] | null> = {
  DEFAULT: null, // Always included
  TYPESCRIPT: ['typescript'],
  REACT: ['react', 'react-dom', 'preact', 'solid-js', 'vue'],
  MARKDOWN: null, // Always included
  DATA: null, // Always included
};
