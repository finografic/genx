/**
 * CSS feature — oxfmt presets for CSS/SCSS; strips legacy Stylelint / VS Code stylelint wiring (migration
 * only).
 */

// DEPRECATED: Package name strings kept only so `previewCss` can remove them from consumer `package.json`;
// delete when Stylelint migration support is dropped (no firm date).
import { PKG_STYLELINT, PKG_STYLELINT_STYLISTIC } from 'config/constants.config';

export const STYLELINT_PACKAGE = PKG_STYLELINT;
export const STYLELINT_STYLISTIC_PACKAGE = PKG_STYLELINT_STYLISTIC;

// DEPRECATED: VS Code extension id used only to strip `stylelint.vscode-stylelint` from `extensions.json`.
export const CSS_VSCODE_EXTENSIONS = ['stylelint.vscode-stylelint'] as const;

// DEPRECATED: Filenames used only to delete legacy config files during migration.
export const STYLELINT_CONFIG_FILENAME = 'stylelint.config.ts';
export const LEGACY_STYLELINTRC_FILENAME = '.stylelintrc.json';

/** Language IDs for oxfmt (oxc) formatter settings */
export const CSS_OXFMT_LANGUAGES = ['css', 'scss'] as const;

/** Patched when the css feature adds the SCSS/CSS oxfmt override */
export const OXFMT_CONFIG_FILENAME = 'oxfmt.config.ts';
