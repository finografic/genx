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

/** Filename for the stylelint config */
export const STYLELINTRC_FILENAME = '.stylelintrc.json';

/** Default .stylelintrc.json content */
export const STYLELINTRC_CONTENT = {
  plugins: ['@stylistic/stylelint-plugin'],
  rules: {
    '@stylistic/indentation': 2,
    '@stylistic/no-extra-semicolons': true,
    '@stylistic/max-empty-lines': 1,
  },
};

/** VSCode settings added by the CSS feature */
export const CSS_VSCODE_SETTINGS = {
  'stylelint.enable': true,
  'stylelint.validate': ['css', 'scss'],
  'css.validate': false,
  'scss.validate': false,
} as const;

/** Language IDs for dprint formatter settings */
export const CSS_DPRINT_LANGUAGES = ['css', 'scss'] as const;
