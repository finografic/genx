/**
 * Markdown feature configuration.
 */

import { PKG_MD_LINT } from 'config/constants.config';
import { policy } from 'config/policy.js';

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

/** VSCode extension IDs for markdownlint */
export const MARKDOWNLINT_VSCODE_EXTENSIONS = ['davidanson.vscode-markdownlint'] as const;

/** @deprecated Legacy inline VSCode markdownlint settings block. Remove after migration window. */
export const MARKDOWNLINT_CONFIG_KEY = 'markdownlint.config';

/** VSCode settings key for markdown preview styles */
export const MARKDOWN_STYLES_KEY = 'markdown.styles';

/** Legacy markdown.styles path — used to detect and migrate old configurations. */
export const MARKDOWN_STYLES_LEGACY_PATH = '.vscode/markdown-github-light.css';

/** CSS asset filenames shipped in the md-lint package (and previously copied into .vscode/). */
export const MD_LINT_CSS_FILES = ['markdown-github-light.css', 'markdown-custom-dark.css'] as const;

export const MARKDOWNLINT_CONFIG_FILE = '.markdownlint.jsonc';
export const MARKDOWNLINT_CONFIG_EXTENDS_KEY = 'extends';
export const MARKDOWNLINT_CONFIG_EXTENDS_VALUE = 'node_modules/@finografic/md-lint/.markdownlint.jsonc';
export const MARKDOWNLINT_CONFIG_FILE_TEXT = `{\n  "${MARKDOWNLINT_CONFIG_EXTENDS_KEY}": "${MARKDOWNLINT_CONFIG_EXTENDS_VALUE}"\n}\n`;

/**
 * VSCode settings for markdown preview styles only. Does NOT set [markdown] or oxc.oxc-vscode.
 */
export const MARKDOWN_VSCODE_SETTINGS = {
  [MARKDOWN_STYLES_KEY]: ['node_modules/@finografic/md-lint/styles/markdown-github-light.css'],
} as const;
