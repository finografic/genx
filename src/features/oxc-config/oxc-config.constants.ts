/**
 * Oxc-config feature — align `@finografic/oxc-config` + `oxfmt` + `oxlint` with template.
 *
 * PRETTIER_* are used when replacing Prettier: detect Prettier, uninstall the package, and remove Prettier
 * config files when applying oxc-config.
 *
 * **Legacy ESLint:** `eslint.config.*` is only referenced to strip redundant stylistic rules /
 * simple-import-sort — not to add or preserve ESLint as the primary linter.
 */

export const OXFMT_CONFIG_PACKAGE = '@finografic/oxc-config';

/** Oxfmt CLI (formatter; used with {@link OXFMT_CONFIG_PACKAGE} presets). */
export const OXFMT_CLI_PACKAGE = 'oxfmt';

/** Oxlint CLI — primary linter alongside oxfmt. */
export const OXLINT_CLI_PACKAGE = 'oxlint';

/** VSCode extension for oxfmt via Oxc */
export const OXFMT_VSCODE_EXTENSIONS = ['oxc.oxc-vscode'] as const;

export const OXFMT_FORMATTER_ID = 'oxc.oxc-vscode';

/**
 * Exact Prettier-related package names to uninstall when replacing with oxc-config.
 */
export const PRETTIER_PACKAGES = ['prettier', 'eslint-config-prettier', 'eslint-plugin-prettier'] as const;

/**
 * Glob patterns to match Prettier-related packages (e.g., "_prettier-plugin-_").
 */
export const PRETTIER_PACKAGE_PATTERNS = ['*prettier-plugin-*'] as const;

/** Legacy formatter packages to remove when migrating to oxc-config. */
export const DPRINT_PACKAGES = ['dprint', '@finografic/dprint-config'] as const;

/** Import-sort plugin — redundant once formatting/import order is handled by oxc-config. */
export const SIMPLE_IMPORT_SORT_PACKAGE = 'eslint-plugin-simple-import-sort' as const;

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

/** Prettier config filenames to detect and remove when replacing with oxc-config. */
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

export const OXFMT_LINT_STAGED_COMMAND = 'oxfmt --no-error-on-unmatched-pattern';
export const OXFMT_LINT_STAGED_CODE_PATTERN = '*.{ts,tsx,js,jsx,mjs,cjs}';
/** Lint-staged: `*.md` — template may use oxfmt + md-lint or oxfmt + oxlint. */
export const OXFMT_LINT_STAGED_MD_PATTERN = '*.md';
export const OXFMT_LINT_STAGED_DATA_PATTERN = '*.{json,jsonc,yml,yaml,toml}';

/** Oxlint fix command for lint-staged (matches `_templates/package.json`). */
export const OXLINT_LINT_STAGED_FIX =
  'oxlint -c oxlint.config.ts --fix --no-error-on-unmatched-pattern' as const;

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

/**
 * Stylistic rules that oxfmt fully replaces — safe to strip from **legacy** `eslint.config.*`. Does not
 * include indent / ternary rules (kept in sync with oxfmt per @finografic conventions).
 */
export const OXFMT_COVERED_STYLISTIC_RULES = [
  '@stylistic/semi',
  '@stylistic/quotes',
  '@stylistic/comma-dangle',
  '@stylistic/no-trailing-spaces',
  '@stylistic/no-multiple-empty-lines',
];
