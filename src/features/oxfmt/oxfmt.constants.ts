/**
 * oxfmt feature — migrate an existing package to @finografic/oxfmt-config + oxfmt CLI.
 *
 * PRETTIER_* are used when replacing Prettier: detect Prettier, uninstall the package,
 * and backup Prettier config files before applying oxfmt.
 */

export const OXFMT_CONFIG_PACKAGE = '@finografic/oxfmt-config';
export const OXFMT_CONFIG_PACKAGE_VERSION = 'latest';

/** oxfmt CLI (peer-style; installed alongside @finografic/oxfmt-config) */
export const OXFMT_CLI_PACKAGE = 'oxfmt';
export const OXFMT_CLI_VERSION = 'latest';

/** VSCode extension for oxfmt via Oxc */
export const OXFMT_VSCODE_EXTENSIONS = ['oxc.oxc-vscode'] as const;

export const OXFMT_FORMATTER_ID = 'oxc.oxc-vscode';

/**
 * Exact Prettier-related package names to uninstall when replacing with oxfmt.
 */
export const PRETTIER_PACKAGES = ['prettier', 'eslint-config-prettier', 'eslint-plugin-prettier'] as const;

/**
 * Glob patterns to match Prettier-related packages (e.g., "*prettier-plugin-*").
 */
export const PRETTIER_PACKAGE_PATTERNS = ['*prettier-plugin-*'] as const;

/** Prettier config filenames to detect and backup when replacing with oxfmt. */
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
  'format.check': 'oxfmt --check',
  'format.fix': 'oxfmt',
};

export const OXFMT_UPDATE_SCRIPT = {
  key: 'update.oxfmt-config',
  value: 'pnpm update @finografic/oxfmt-config --latest && pnpm update oxfmt --latest',
};

export const OXFMT_LINT_STAGED_COMMAND = 'oxfmt --no-error-on-unmatched-pattern';
export const OXFMT_LINT_STAGED_CODE_PATTERN = '*.{ts,tsx,js,jsx,mjs,cjs}';
export const OXFMT_LINT_STAGED_DATA_PATTERN = '*.{json,jsonc,md,yml,yaml,toml}';

/** CI workflow format check step (appended to ci.yml) */
export const OXFMT_CI_STEP = `
      - name: Format check
        run: pnpm format.check
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
 * Stylistic rules that oxfmt fully replaces — safe to strip from eslint.config.ts.
 * Does not include indent / ternary rules (kept in sync with oxfmt per @finografic conventions).
 */
export const OXFMT_COVERED_STYLISTIC_RULES = [
  '@stylistic/semi',
  '@stylistic/quotes',
  '@stylistic/comma-dangle',
  '@stylistic/no-trailing-spaces',
  '@stylistic/no-multiple-empty-lines',
];
