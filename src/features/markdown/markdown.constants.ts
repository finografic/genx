/**
 * Markdown feature configuration.
 */

import { PKG_MD_LINT } from 'config/constants.config';

export const MD_LINT_PACKAGE = PKG_MD_LINT;
export const MD_LINT_PACKAGE_VERSION = 'latest';

/** Legacy lint-staged glob that merged data files + `md` (split into data-only + `*.md` by the markdown feature). */
export const LINT_STAGED_DATA_WITH_MD_PATTERN = '*.{json,jsonc,yml,yaml,toml,md}';
export const LINT_STAGED_DATA_ONLY_PATTERN = '*.{json,jsonc,yml,yaml,toml}';
export const LINT_STAGED_MD_PATTERN = '*.md';
export const LINT_STAGED_OXFMT_CMD = 'oxfmt --no-error-on-unmatched-pattern';
export const LINT_STAGED_MD_LINT_CMD = 'md-lint --fix';

/** Script keys added to package.json by the markdown feature. */
export const MD_LINT_SCRIPT = 'lint.md';
export const MD_LINT_FIX_SCRIPT = 'lint.md.fix';

/** VSCode extension IDs for markdownlint */
export const MARKDOWNLINT_VSCODE_EXTENSIONS = ['davidanson.vscode-markdownlint'] as const;

/** VSCode settings key for markdownlint config */
export const MARKDOWNLINT_CONFIG_KEY = 'markdownlint.config';

/** VSCode settings key for markdown preview styles */
export const MARKDOWN_STYLES_KEY = 'markdown.styles';

/** Legacy markdown.styles path — used to detect and migrate old configurations. */
export const MARKDOWN_STYLES_LEGACY_PATH = '.vscode/markdown-github-light.css';

/** CSS files previously copied into .vscode/ — now shipped in the md-lint package. */
export const MARKDOWN_LEGACY_CSS_FILES = ['markdown-github-light.css', 'markdown-custom-dark.css'] as const;

/**
 * VSCode settings for markdown (markdownlint + preview styles only).
 * Does NOT set [markdown] or oxc.oxc-vscode.
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
