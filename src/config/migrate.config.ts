import type { MigrateConfig } from 'types/migrate.types';
import { sharedConfig } from './shared.config';

export const migrateConfig: MigrateConfig = {
  defaultScope: sharedConfig.defaultScope,

  syncFromTemplate: [
    { section: 'hooks', templatePath: '.simple-git-hooks.mjs', targetPath: '.simple-git-hooks.mjs' },
    { section: 'nvmrc', templatePath: '.nvmrc', targetPath: '.nvmrc' },
    { section: 'eslint', templatePath: 'eslint.config.ts', targetPath: 'eslint.config.ts' },
    { section: 'workflows', templatePath: '.github/workflows/release.yml', targetPath: '.github/workflows/release.yml' },
    { section: 'docs', templatePath: 'docs', targetPath: 'docs' },
  ],

  packageJson: {
    ensureScripts: sharedConfig.packageJsonScripts,
    ensureLintStaged: sharedConfig.lintStaged,
    ensureKeywords: sharedConfig.keywords,
  },
};
