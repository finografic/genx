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
export const LEGACY_VSCODE_EXTENSIONS_TO_REMOVE = ['dbaeumer.vscode-eslint', 'dprint.dprint'] as const;

export const OXFMT_FORMATTER_ID = 'oxc.oxc-vscode';

/**
 * Exact Prettier-related package names to uninstall when replacing with oxfmt.
 */
export const PRETTIER_PACKAGES = ['prettier'] as const;

/**
 * Glob patterns to match Prettier-related packages (e.g., "_prettier-plugin-_").
 */
export const PRETTIER_PACKAGE_PATTERNS = ['*prettier-plugin-*'] as const;

/** Legacy @finografic/oxfmt-config replaced by @finografic/oxc-config. */
export const LEGACY_OXFMT_CONFIG_PACKAGE = '@finografic/oxfmt-config' as const;

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
export const LEGACY_LINT_STAGED_COMMAND_PATTERNS = [/^\s*eslint\b/, /^\s*dprint\b/] as const;

/** CI workflow format check step (appended to ci.yml) */
export const OXFMT_CI_STEP = `

      - name: Format check
        run: pnpm format:check
`;

/** Base languages for all package types (matches `_templates/.vscode/settings.json` + toml). */
export const OXC_VSCODE_BASE_LANGUAGES = [
  'javascript',
  'typescript',
  'json',
  'jsonc',
  'yaml',
  'toml',
  'markdown',
] as const;

/** Extra formatter languages for front-end (React) packages only. */
export const OXC_VSCODE_FRONTEND_LANGUAGES = [
  'javascriptreact',
  'typescriptreact',
  'css',
  'scss',
  'html',
] as const;

/** @deprecated Prefer {@link OXC_VSCODE_BASE_LANGUAGES} + type-aware frontend list. */
export const CANONICAL_VSCODE_LANGUAGES = [
  ...OXC_VSCODE_BASE_LANGUAGES,
  ...OXC_VSCODE_FRONTEND_LANGUAGES,
] as const;
