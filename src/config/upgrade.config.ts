import type { UpgradeConfig } from 'types/upgrade.types';

import { sharedConfig } from './shared.config';

export const upgradeConfig: UpgradeConfig = {
  defaultScope: sharedConfig.defaultScope,

  syncFromTemplate: [
    { section: 'package-json', templatePath: '.npmrc', targetPath: '.npmrc' },
    // No `.husky/*` or `commitlint.config.mjs` entries: the `gitHooks` feature owns those files and
    // writes them from its own constants. Copying them here as well made `_templates/` a second
    // source for the same content, and this path overwrites without showing a diff — so whichever
    // ran last silently won. See `src/features/git-hooks/`.
    // No `.nvmrc` entry: the `node` section writes it from deps-policy's toolchain, the same source
    // `create` uses. Copying `_templates/.nvmrc` as well made the template a second source of truth
    // for the node version, and a stale template downgraded targets — monorepo-starter went from
    // 24.16.0 to 24.3.0 that way, contradicting its own engines.node in the same run.
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
