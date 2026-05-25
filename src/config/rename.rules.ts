export interface RenameRule {
  canonical: string;
  alternatives: string[];
}

export const renameRules: RenameRule[] = [
  {
    canonical: '.nvmrc',
    alternatives: ['.nvm'],
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
