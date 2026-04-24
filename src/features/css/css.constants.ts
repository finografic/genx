/**
 * CSS feature configuration.
 */

import { PKG_STYLELINT, PKG_STYLELINT_STYLISTIC } from 'config/constants.config';

// DEPRECATED: stylelint replaced by oxfmt for CSS. Kept for removal detection.
export const STYLELINT_PACKAGE = PKG_STYLELINT;
// DEPRECATED: @stylistic/stylelint-plugin replaced by oxfmt. Kept for removal detection.
export const STYLELINT_STYLISTIC_PACKAGE = PKG_STYLELINT_STYLISTIC;

/** VSCode extension ID for stylelint — kept to remove from recommendations */
// DEPRECATED: stylelint.vscode-stylelint removed in favour of oxc.oxc-vscode.
export const CSS_VSCODE_STYLELINT_EXT = 'stylelint.vscode-stylelint' as const;

// DEPRECATED: No longer created — kept to detect and delete legacy configs.
export const STYLELINT_CONFIG_FILENAME = 'stylelint.config.ts';

/** Legacy JSON config removed on apply when present */
export const LEGACY_STYLELINTRC_FILENAME = '.stylelintrc.json';

// DEPRECATED: stylelint.config.ts body — only kept to identify the file pattern for deletion.
export const STYLELINT_CONFIG_TS_CONTENT = `import type { Config } from 'stylelint';

export default {
  plugins: ['@stylistic/stylelint-plugin'],
  rules: {
    '@stylistic/indentation': 2,
    '@stylistic/no-extra-semicolons': true,
    '@stylistic/max-empty-lines': 1,
  },
} satisfies Config;
`;

// DEPRECATED: stylelint VSCode settings — kept for removal detection.
export const CSS_VSCODE_STYLELINT_SETTINGS_KEYS = ['stylelint.enable', 'stylelint.validate'] as const;

/** Language IDs for oxfmt (oxc) formatter settings */
export const CSS_OXFMT_LANGUAGES = ['css', 'scss'] as const;

/** Patched when the css feature adds the SCSS/CSS oxfmt override */
export const OXFMT_CONFIG_FILENAME = 'oxfmt.config.ts';
