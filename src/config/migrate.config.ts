import type { MigrateConfig } from 'types/migrate.types';
import { sharedConfig } from './shared.config';

export const migrateConfig: MigrateConfig = {
  defaultScope: sharedConfig.defaultScope,

  syncFromTemplate: [
    { section: 'package-json', templatePath: '.npmrc', targetPath: '.npmrc' },
    {
      section: 'hooks',
      templatePath: '.husky/pre-commit',
      targetPath: '.husky/pre-commit',
    },
    {
      section: 'hooks',
      templatePath: '.husky/commit-msg',
      targetPath: '.husky/commit-msg',
    },
    { section: 'hooks', templatePath: 'commitlint.config.mjs', targetPath: 'commitlint.config.mjs' },
    { section: 'nvmrc', templatePath: '.nvmrc', targetPath: '.nvmrc' },
    { section: 'eslint', templatePath: 'eslint.config.ts', targetPath: 'eslint.config.ts' },
    {
      section: 'eslint',
      templatePath: 'src/declarations.d.ts',
      targetPath: 'src/declarations.d.ts',
    },
    {
      section: 'workflows',
      templatePath: '.github/workflows/ci.yml',
      targetPath: '.github/workflows/ci.yml',
    },
    {
      section: 'workflows',
      templatePath: '.github/workflows/release.yml',
      targetPath: '.github/workflows/release.yml',
    },
    { section: 'docs', templatePath: '.env.example', targetPath: '.env.example' },
    { section: 'docs', templatePath: 'docs', targetPath: 'docs' },
  ],

  packageJson: {
    ensureScripts: sharedConfig.packageJsonScripts,
    ensureLintStaged: sharedConfig.lintStaged,
    ensureKeywords: sharedConfig.keywords,
  },
};
