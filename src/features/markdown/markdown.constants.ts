/**
 * Markdown feature configuration.
 */

import { policy } from '@finografic/deps-policy';

import { PKG_MD_LINT } from 'config/constants.config';

export const MD_LINT_PACKAGE = PKG_MD_LINT;
export const MD_LINT_PACKAGE_VERSION = policy.base.devDependencies?.[PKG_MD_LINT] ?? 'latest';

/**
 * Legacy lint-staged glob that merged data files + `md` (split into data-only + `*.md` by the markdown
 * feature).
 */
export const LINT_STAGED_DATA_WITH_MD_PATTERN = '*.{json,jsonc,yml,yaml,toml,md}';
export const LINT_STAGED_DATA_ONLY_PATTERN = '*.{json,jsonc,yml,yaml,toml}';
export const LINT_STAGED_MD_PATTERN = '*.md';
export const LINT_STAGED_OXFMT_CMD = 'oxfmt --no-error-on-unmatched-pattern';
export const LINT_STAGED_MD_LINT_CMD = 'md-lint --fix';

/** Script keys added to package.json by the markdown feature. */
export const MD_LINT_SCRIPT = 'lint:md';
export const MD_LINT_FIX_SCRIPT = 'lint:md:fix';

// DEPRECATED: ESLint plugin package ids — devDependency removal / eslint.config stripping only; remove with ESLint purge.
/** Legacy ESLint plugin replaced by `@finografic/md-lint`. */
export const ESLINT_PLUGIN_MARKDOWNLINT = 'eslint-plugin-markdownlint';

/** Legacy import-sort plugin — removed alongside markdownlint in the md-lint migration. */
export const ESLINT_PLUGIN_SIMPLE_IMPORT_SORT = 'eslint-plugin-simple-import-sort';

/** TypeScript declarations file that exists solely to type `eslint-plugin-markdownlint`. */
export const MARKDOWNLINT_DECLARATIONS_FILE = 'src/declarations.d.ts';

/** Marker string used to confirm a declarations.d.ts is markdownlint-only and safe to delete. */
export const MARKDOWNLINT_DECLARATIONS_MARKER = 'eslint-plugin-markdownlint';

/** VSCode extension IDs for markdownlint */
export const MARKDOWNLINT_VSCODE_EXTENSIONS = ['davidanson.vscode-markdownlint'] as const;

/** VSCode settings key for markdownlint config */
export const MARKDOWNLINT_CONFIG_KEY = 'markdownlint.config';

/** VSCode settings key for markdown preview styles */
export const MARKDOWN_STYLES_KEY = 'markdown.styles';

/** Legacy markdown.styles path — used to detect and migrate old configurations. */
export const MARKDOWN_STYLES_LEGACY_PATH = '.vscode/markdown-github-light.css';

/** CSS asset filenames shipped in the md-lint package (and previously copied into .vscode/). */
export const MD_LINT_CSS_FILES = ['markdown-github-light.css', 'markdown-custom-dark.css'] as const;

/**
 * VSCode settings for markdown (markdownlint + preview styles only). Does NOT set [markdown] or
 * oxc.oxc-vscode.
 */
export const MARKDOWN_VSCODE_SETTINGS = {
  [MARKDOWNLINT_CONFIG_KEY]: {
    default: true,
    MD013: { line_length: 120, tables: false, code_blocks: false }, // Allow line length
    MD024: false, // Allow duplicate headings
    MD025: false, // Allow multiple top-level headings
    MD036: false, // No emphasis as heading
    MD040: false, // Allow fenced code blocks
    MD041: false, // Don't require first line to be a top-level heading
    MD060: { style: 'aligned' }, // Allow heading indentation
  },
  [MARKDOWN_STYLES_KEY]: ['node_modules/@finografic/md-lint/styles/markdown-github-light.css'],
} as const;
