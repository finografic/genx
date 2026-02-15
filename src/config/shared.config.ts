/**
 * Shared configuration used by both create and migrate commands.
 * This ensures consistency between scaffolding new packages and updating existing ones.
 */

export interface SharedConfig {
  /** Default scope for @finografic packages */
  defaultScope: string;

  /**
   * Package.json scripts that should be present in all @finografic packages.
   * These match what's in _templates/package.json.
   */
  packageJsonScripts: Record<string, string>;

  /**
   * lint-staged configuration that should be present in all @finografic packages.
   */
  lintStaged: Record<string, string[]>;

  /**
   * Keywords configuration.
   */
  keywords: {
    /** Always ensure this keyword exists */
    includeFinograficKeyword: string;
    /** Also ensure the package name (without scope) exists */
    includePackageName: boolean;
  };
}

export const sharedConfig: SharedConfig = {
  /** Default scope for @finografic packages */
  defaultScope: '@finografic',

  /**
   * Package.json scripts that should be present in all @finografic packages.
   * These match what's in _templates/package.json.
   */
  packageJsonScripts: {
    test: 'vitest',
    'test.run': 'vitest run',
    'test.coverage': 'vitest run --coverage',
    lint: 'eslint .',
    'lint.fix': 'eslint . --fix',
    typecheck: 'tsc --project tsconfig.json --noEmit',
    'tsc.debug': 'tsc --pretty --project tsconfig.json',
    'release.check': 'pnpm lint.fix && pnpm typecheck && pnpm test.run',
    'release.github.patch':
      'pnpm run release.check && pnpm version patch && git push --follow-tags',
    'release.github.minor':
      'pnpm run release.check && pnpm version minor && git push --follow-tags',
    'release.github.major':
      'pnpm run release.check && pnpm version major && git push --follow-tags',
    link: 'pnpm build && pnpm link --global',
    unlink: 'pnpm unlink --global',
    prepack: 'pnpm build',
    prepare: 'simple-git-hooks',
  },

  /**
   * lint-staged configuration that should be present in all @finografic packages.
   */
  lintStaged: {
    '*.{ts,tsx,js,mjs,cjs}': ['eslint --fix'],
  },

  /**
   * Keywords configuration.
   */
  keywords: {
    /** Always ensure this keyword exists */
    includeFinograficKeyword: 'finografic',
    /** Also ensure the package name (without scope) exists */
    includePackageName: true,
  },
};
