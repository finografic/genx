export type MigrateOnlySection = 'package-json' | 'hooks' | 'nvmrc' | 'eslint' | 'workflows' | 'docs';

export type MigrateConfig = {
  /** Default scope expected for existing @finografic packages */
  defaultScope: string;

  /**
   * Files/dirs to sync from `templates/package/` into the target repository.
   * These are treated as “locked” convention surfaces.
   *
   * NOTE: copy is template-aware (token replacement) for common text formats.
   */
  syncFromTemplate: Array<{
    /** Path relative to `templates/package` */
    templatePath: string;
    /** Path relative to target repo root */
    targetPath: string;
    /** Which `--only` section controls this item */
    section: MigrateOnlySection;
  }>;

  /**
   * package.json patch behavior.
   * Keep this small and predictable; do not try to be “smart” about arbitrary JSON merges.
   */
  packageJson: {
    ensureScripts: Record<string, string>;
    ensureLintStaged: Record<string, string[]>;
    ensureKeywords: {
      /** Always ensure this keyword exists */
      includeFinograficKeyword: string;
      /** Also ensure the package name (without scope) exists */
      includePackageName: boolean;
    };
  };
};

export const migrateConfig: MigrateConfig = {
  defaultScope: '@finografic',

  syncFromTemplate: [
    { section: 'hooks', templatePath: '.simple-git-hooks.mjs', targetPath: '.simple-git-hooks.mjs' },
    { section: 'nvmrc', templatePath: '.nvmrc', targetPath: '.nvmrc' },
    { section: 'eslint', templatePath: 'eslint.config.mjs', targetPath: 'eslint.config.mjs' },
    { section: 'workflows', templatePath: '.github/workflows/release.yml', targetPath: '.github/workflows/release.yml' },
    { section: 'docs', templatePath: 'docs', targetPath: 'docs' },
  ],

  packageJson: {
    ensureScripts: {
      test: 'vitest',
      'test.run': 'vitest run',
      'test.coverage': 'vitest run --coverage',
      lint: 'eslint .',
      'lint.fix': 'eslint . --fix',
      typecheck: 'tsc --project tsconfig.json --noEmit',
      'tsc.debug': 'tsc --pretty --project tsconfig.json',
      'release.check': 'pnpm lint.fix && pnpm typecheck && pnpm test.run',
      'release.github.patch': 'pnpm run release.check && pnpm version patch && git push --follow-tags',
      'release.github.minor': 'pnpm run release.check && pnpm version minor && git push --follow-tags',
      'release.github.major': 'pnpm run release.check && pnpm version major && git push --follow-tags',
      prepack: 'pnpm build',
      prepare: 'simple-git-hooks',
    },
    ensureLintStaged: {
      '*.{ts,tsx,js,mjs,cjs}': ['eslint --fix'],
    },
    ensureKeywords: {
      includeFinograficKeyword: 'finografic',
      includePackageName: true,
    },
  },
};
