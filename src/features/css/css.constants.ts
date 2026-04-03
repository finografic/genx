/**
 * CSS linting feature configuration.
 */

import { PKG_STYLELINT, PKG_STYLELINT_STYLISTIC } from 'config/constants.config';

export const STYLELINT_PACKAGE = PKG_STYLELINT;
export const STYLELINT_PACKAGE_VERSION = 'latest';

export const STYLELINT_STYLISTIC_PACKAGE = PKG_STYLELINT_STYLISTIC;
export const STYLELINT_STYLISTIC_PACKAGE_VERSION = 'latest';

/** VSCode extension ID for stylelint */
export const CSS_VSCODE_EXTENSIONS = ['stylelint.vscode-stylelint'] as const;

/** Primary stylelint config (flat TS module) */
export const STYLELINT_CONFIG_FILENAME = 'stylelint.config.ts';

/** Legacy JSON config removed on apply when present */
export const LEGACY_STYLELINTRC_FILENAME = '.stylelintrc.json';

/** Default stylelint.config.ts body */
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

/** VSCode settings added by the CSS feature */
export const CSS_VSCODE_SETTINGS = {
  'stylelint.enable': true,
  'stylelint.validate': ['css', 'scss'],
  'css.validate': false,
  'scss.validate': false,
} as const;

/** Language IDs for oxfmt (oxc) formatter settings */
export const CSS_OXFMT_LANGUAGES = ['css', 'scss'] as const;

/** Patched when the css feature adds the SCSS/CSS oxfmt override */
export const OXFMT_CONFIG_FILENAME = 'oxfmt.config.ts';
