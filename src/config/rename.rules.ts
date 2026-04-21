export interface RenameRule {
  canonical: string;
  alternatives: string[];
}

export const renameRules: RenameRule[] = [
  {
    canonical: '.nvmrc',
    alternatives: ['.nvm'],
  },
  // DEPRECATED: ESLint filename normalization for migrate only; remove when ESLint is fully gone (no firm date).
  {
    canonical: 'eslint.config.ts',
    alternatives: [
      '.eslintrc',
      '.eslintrc.js',
      '.eslintrc.cjs',
      'eslint.config.mjs',
      'eslint.config.cjs',
      'eslint.config.js',
    ],
  },
  {
    canonical: 'oxlint.config.ts',
    alternatives: [],
  },
  {
    canonical: 'commitlint.config.mjs',
    alternatives: [
      '.commitlintrc',
      '.commitlintrc.js',
      '.commitlintrc.json',
      'commitlint.config.js',
      'commitlint.config.cjs',
      'commitlint.config.ts',
    ],
  },
];
