/**
 * Oxfmt feature — migrate an existing package to @finografic/oxc-config + oxfmt + oxlint.
 *
 * PRETTIER_* are used when replacing Prettier: detect Prettier, uninstall the package, and remove Prettier
 * config files when applying oxfmt.
 */

export const OXC_CONFIG_PACKAGE = '@finografic/oxc-config';

/** Oxfmt CLI (peer-style; installed alongside @finografic/oxc-config) */
export const OXFMT_CLI_PACKAGE = 'oxfmt';

/** Oxlint CLI */
export const OXLINT_PACKAGE = 'oxlint';

/** VSCode extension for oxfmt via Oxc */
export const OXFMT_VSCODE_EXTENSIONS = ['oxc.oxc-vscode'] as const;

export const OXFMT_FORMATTER_ID = 'oxc.oxc-vscode';

/**
 * Exact Prettier-related package names to uninstall when replacing with oxfmt.
 */
export const PRETTIER_PACKAGES = ['prettier', 'eslint-config-prettier', 'eslint-plugin-prettier'] as const;

/**
 * Glob patterns to match Prettier-related packages (e.g., "_prettier-plugin-_").
 */
export const PRETTIER_PACKAGE_PATTERNS = ['*prettier-plugin-*'] as const;

/** Legacy formatter packages to remove when migrating to oxfmt. */
export const DPRINT_PACKAGES = ['dprint', '@finografic/dprint-config'] as const;

// DEPRECATED: eslint-plugin-simple-import-sort replaced by oxfmt import sorting. Kept for removal.
export const SIMPLE_IMPORT_SORT_PACKAGE = 'eslint-plugin-simple-import-sort' as const;

// DEPRECATED: @finografic/oxfmt-config replaced by @finografic/oxc-config. Kept for removal.
export const LEGACY_OXFMT_CONFIG_PACKAGE = '@finografic/oxfmt-config' as const;

// DEPRECATED: ESLint stack replaced by oxlint. Kept for removal during oxc-config migration.
export const ESLINT_PACKAGES_TO_REMOVE = [
  'eslint',
  '@eslint/js',
  '@finografic/eslint-config',
  '@stylistic/eslint-plugin',
  '@typescript-eslint/parser',
  '@typescript-eslint/eslint-plugin',
  'typescript-eslint',
] as const;

/** Legacy formatter config files to delete when migrating away. */
export const DPRINT_CONFIG_FILES = ['dprint.jsonc', 'dprint.json', 'dprint.config.jsonc'] as const;

/**
 * Legacy lint-staged keys merged into {@link OXFMT_LINT_STAGED_DATA_PATTERN} (data files only; `*.md` is
 * handled separately).
 */
export const OXFMT_LINT_STAGED_DATA_PATTERN_ALIASES = [
  '*.{json,jsonc,yml,yaml,toml,md}',
  '*.{json,jsonc,md,yml,yaml,toml}',
] as const;

/** Prettier config filenames to detect and remove when replacing with oxfmt. */
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
  'format:check': 'oxfmt --check',
  'format:fix': 'oxfmt',
};

export const OXFMT_UPDATE_SCRIPT = {
  key: 'update:oxc-config',
  value:
    'pnpm update @finografic/oxc-config --latest && pnpm update oxfmt --latest && pnpm update oxlint --latest',
};

// DEPRECATED: Old update script key — removed when canonicalizing scripts.
export const LEGACY_OXFMT_UPDATE_SCRIPT_KEY = 'update:oxfmt-config' as const;

export const OXFMT_LINT_STAGED_COMMAND = 'oxfmt --no-error-on-unmatched-pattern';
export const OXLINT_LINT_STAGED_COMMAND = 'oxlint -c oxlint.config.ts --fix --no-error-on-unmatched-pattern';
export const OXFMT_LINT_STAGED_CODE_PATTERN = '*.{ts,tsx,js,jsx,mjs,cjs}';
/** Lint-staged: `*.md` runs oxfmt then oxlint (data glob excludes `md`). */
export const OXFMT_LINT_STAGED_MD_PATTERN = '*.md';
export const OXFMT_LINT_STAGED_DATA_PATTERN = '*.{json,jsonc,yml,yaml,toml}';

/** CI workflow format check step (appended to ci.yml) */
export const OXFMT_CI_STEP = `
      - name: Format check
        run: pnpm format:check
`;

/**
 * Language categories for oxfmt VSCode settings (oxc formatter).
 */
export const OXFMT_LANGUAGE_CATEGORIES = {
  DEFAULT: ['javascript', 'json', 'jsonc'] as const,
  TYPESCRIPT: ['typescript'] as const,
  REACT: ['typescriptreact', 'javascriptreact', 'css', 'scss', 'html'] as const,
  MARKDOWN: ['markdown'] as const,
  DATA: ['yaml', 'toml'] as const,
} as const;

export type OxfmtLanguageCategory = keyof typeof OXFMT_LANGUAGE_CATEGORIES;

export const OXFMT_CATEGORY_DEPENDENCIES: Record<OxfmtLanguageCategory, string[] | null> = {
  DEFAULT: null,
  TYPESCRIPT: ['typescript'],
  REACT: ['react', 'react-dom', 'preact', 'solid-js', 'vue'],
  MARKDOWN: null,
  DATA: null,
};

// DEPRECATED: oxfmt replaces these ESLint stylistic rules entirely. Kept only as a reference;
// the oxc-config feature now deletes eslint.config.* rather than cleaning individual rules.
export const OXFMT_COVERED_STYLISTIC_RULES = [
  '@stylistic/semi',
  '@stylistic/quotes',
  '@stylistic/comma-dangle',
  '@stylistic/no-trailing-spaces',
  '@stylistic/no-multiple-empty-lines',
];
