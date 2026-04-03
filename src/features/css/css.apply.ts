import { unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileExists, installDevDependency, isDependencyDeclared, spinner, successMessage } from 'utils';
import type { FeatureApplyResult, FeatureContext } from '../feature.types';

import {
  LEGACY_STYLELINTRC_FILENAME,
  STYLELINT_CONFIG_FILENAME,
  STYLELINT_CONFIG_TS_CONTENT,
  STYLELINT_PACKAGE,
  STYLELINT_PACKAGE_VERSION,
  STYLELINT_STYLISTIC_PACKAGE,
  STYLELINT_STYLISTIC_PACKAGE_VERSION,
} from './css.constants';
import { patchOxfmtConfigForCss } from './css.oxfmt';
import { applyCssExtensions, applyCssOxfmtSettings, applyCssVSCodeSettings } from './css.vscode';

/**
 * Apply CSS linting feature to an existing package.
 */
export async function applyCss(context: FeatureContext): Promise<FeatureApplyResult> {
  const applied: string[] = [];

  // 1. Install stylelint
  const stylelintDeclared = await isDependencyDeclared(context.targetDir, STYLELINT_PACKAGE);
  if (!stylelintDeclared) {
    const spin = spinner();
    spin.start(`Installing ${STYLELINT_PACKAGE}...`);
    const result = await installDevDependency(
      context.targetDir,
      STYLELINT_PACKAGE,
      STYLELINT_PACKAGE_VERSION,
    );
    spin.stop(result.installed ? `Installed ${STYLELINT_PACKAGE}` : `${STYLELINT_PACKAGE} already installed`);
    if (result.installed) applied.push(STYLELINT_PACKAGE);
  }

  // 2. Install @stylistic/stylelint-plugin
  const stylisticDeclared = await isDependencyDeclared(context.targetDir, STYLELINT_STYLISTIC_PACKAGE);
  if (!stylisticDeclared) {
    const spin = spinner();
    spin.start(`Installing ${STYLELINT_STYLISTIC_PACKAGE}...`);
    const result = await installDevDependency(
      context.targetDir,
      STYLELINT_STYLISTIC_PACKAGE,
      STYLELINT_STYLISTIC_PACKAGE_VERSION,
    );
    spin.stop(
      result.installed
        ? `Installed ${STYLELINT_STYLISTIC_PACKAGE}`
        : `${STYLELINT_STYLISTIC_PACKAGE} already installed`,
    );
    if (result.installed) applied.push(STYLELINT_STYLISTIC_PACKAGE);
  }

  // 3. Write stylelint.config.ts; drop legacy JSON if present
  const stylelintConfigPath = resolve(context.targetDir, STYLELINT_CONFIG_FILENAME);
  if (!fileExists(stylelintConfigPath)) {
    await writeFile(stylelintConfigPath, STYLELINT_CONFIG_TS_CONTENT, 'utf8');
    applied.push(STYLELINT_CONFIG_FILENAME);
    successMessage('Created stylelint.config.ts');
  }

  const legacyStylelintPath = resolve(context.targetDir, LEGACY_STYLELINTRC_FILENAME);
  if (fileExists(legacyStylelintPath)) {
    await unlink(legacyStylelintPath);
    applied.push(`${LEGACY_STYLELINTRC_FILENAME} (removed)`);
    successMessage('Removed legacy .stylelintrc.json');
  }

  // 4. Configure VSCode settings (stylelint.enable, stylelint.validate, css.validate)
  const settingsModified = await applyCssVSCodeSettings(context.targetDir);
  if (settingsModified) {
    applied.push('.vscode/settings.json (stylelint)');
    successMessage('Added stylelint settings to VSCode');
  }

  // 5. Configure oxfmt (oxc) as CSS/SCSS formatter
  const addedOxfmtLanguages = await applyCssOxfmtSettings(context.targetDir);
  if (addedOxfmtLanguages.length > 0) {
    applied.push(`.vscode/settings.json (oxfmt: ${addedOxfmtLanguages.join(', ')})`);
    successMessage(`Configured oxfmt for: ${addedOxfmtLanguages.join(', ')}`);
  }

  // 5b. Add CSS/SCSS `...css` override to oxfmt.config.ts when missing
  const oxfmtConfigPatched = await patchOxfmtConfigForCss(context.targetDir);
  if (oxfmtConfigPatched) {
    applied.push('oxfmt.config.ts (css override)');
    successMessage('Added CSS/SCSS override to oxfmt.config.ts');
  }

  // 6. Add VSCode extension recommendation
  const addedExtensions = await applyCssExtensions(context.targetDir);
  if (addedExtensions.length > 0) {
    applied.push('.vscode/extensions.json');
    successMessage(`Added extension recommendation: ${addedExtensions.join(', ')}`);
  }

  if (applied.length === 0) {
    return { applied, noopMessage: 'CSS linting already configured. No changes made.' };
  }

  return { applied };
}
