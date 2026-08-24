/**
 * Shared configuration used by both create and upgrade commands. This ensures consistency between scaffolding
 * new packages and updating existing ones.
 */

export interface SharedConfig {
  /** Default scope for @finografic packages */
  defaultScope: string;

  /**
   * Package.json scripts that should be present in all @finografic packages. These match what's in
   * _templates/package.json.
   */
  packageJsonScripts: Record<string, string>;

  /**
   * Lint-staged configuration that should be present in all @finografic packages.
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
   * Package.json scripts that should be present in all @finografic packages. These match what's in
   * _templates/package.json.
   */
  packageJsonScripts: {
    // No `test` / `test:run` / `test:coverage`: the `vitest` feature owns them, and it inserts them
    // under a TESTING section title rather than appending to the end. Listing them here added
    // vitest scripts to packages that never selected the feature, in the wrong place.
    'lint': 'oxlint -c oxlint.config.ts',
    'lint:fix': 'oxlint -c oxlint.config.ts --fix',
    'typecheck': 'tsc --project tsconfig.json --noEmit',
    'tsc:debug': 'tsc --pretty --project tsconfig.json',
    'release:check': 'pnpm lint:fix && pnpm typecheck && pnpm test:run',
    'release:github:patch': 'pnpm run release:check && pnpm version patch && git push --follow-tags',
    'release:github:minor': 'pnpm run release:check && pnpm version minor && git push --follow-tags',
    'release:github:major': 'pnpm run release:check && pnpm version major && git push --follow-tags',
    // pnpm 11 removed `link --global`; `add -g .` registers the package's bins globally.
    // `unlink` reads $npm_package_name so the script stays identical across every package.
    'link': 'pnpm build && pnpm add -g .',
    'unlink': 'pnpm remove -g $npm_package_name',
    'prepack': 'pnpm build',
    'prepare': 'husky',
  },

  /**
   * Lint-staged configuration that should be present in all @finografic packages.
   */
  lintStaged: {
    '*.{ts,tsx,js,jsx,mjs,cjs}': [
      'oxfmt --no-error-on-unmatched-pattern',
      'oxlint -c oxlint.config.ts --fix --no-error-on-unmatched-pattern',
    ],
    // No `*.md`: the `markdown` feature owns it and writes `md-lint --fix`. Claiming it here
    // replaced that with oxlint on every upgrade, which — together with the missing CI step —
    // silently switched markdown linting off in a repository that had it.
    '*.{json,jsonc,yml,yaml,toml}': ['oxfmt --no-error-on-unmatched-pattern'],
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
