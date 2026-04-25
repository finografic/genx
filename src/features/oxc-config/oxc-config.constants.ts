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

/** Oxlint TypeScript type-checking rules */
export const OXLINT_TSGOLINT_PACKAGE = 'oxlint-tsgolint';

/** VSCode extension for oxfmt via Oxc */
export const OXFMT_VSCODE_EXTENSIONS = ['oxc.oxc-vscode'] as const;

export const OXFMT_FORMATTER_ID = 'oxc.oxc-vscode';

// DEPRECATED: legacy VSCode extensions removed when migrating to oxc-config.
export const LEGACY_VSCODE_EXTENSIONS_TO_REMOVE = [
  'dprint.dprint',
  'dbaeumer.vscode-eslint',
  'stylelint.vscode-stylelint',
] as const;

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

// DEPRECATED: ESLint/stylelint stack replaced by oxlint/oxfmt. Kept for removal during migration.
export const ESLINT_PACKAGES_TO_REMOVE = [
  'eslint',
  '@eslint/js',
  '@finografic/eslint-config',
  '@stylistic/eslint-plugin',
  '@stylistic/stylelint-plugin',
  '@typescript-eslint/parser',
  '@typescript-eslint/eslint-plugin',
  'typescript-eslint',
  'globals',
  'eslint-plugin-simple-import-sort',
  // DEPRECATED: stylelint replaced by oxfmt for CSS formatting.
  'stylelint',
] as const;

/** Stylelint config files to delete when migrating to oxfmt CSS formatting. */
export const STYLELINT_CONFIG_FILES = [
  'stylelint.config.ts',
  'stylelint.config.js',
  'stylelint.config.mjs',
  '.stylelintrc',
  '.stylelintrc.json',
  '.stylelintrc.js',
  '.stylelintrc.yml',
  '.stylelintrc.yaml',
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

export const LINTING_SECTION_TITLE = '·········· LINTING';
export const LINTING_SCRIPTS = {
  'lint': 'oxlint -c oxlint.config.ts',
  'lint:fix': 'oxlint -c oxlint.config.ts --fix',
  'lint:ci': 'oxlint -c oxlint.config.ts --quiet',
};

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

// DEPRECATED: Old update script keys — removed when canonicalizing scripts.
export const LEGACY_OXFMT_UPDATE_SCRIPT_KEY = 'update:oxfmt-config' as const;
export const LEGACY_UPDATE_SCRIPTS_TO_REMOVE = ['update:oxfmt-config', 'update:eslint-config'] as const;

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

/** Canonical ordered list of languages that get oxc.oxc-vscode as their default formatter. */
export const CANONICAL_VSCODE_LANGUAGES = [
  'javascript',
  'typescript',
  'javascriptreact',
  'typescriptreact',
  'json',
  'jsonc',
  'yaml',
  'toml',
  'css',
  'scss',
  'html',
  'markdown',
] as const;
