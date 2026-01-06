import type { DependencyRule } from 'types/dependencies.types';

export const dependencyRules: DependencyRule[] = [
  // core tooling
  { name: 'typescript', version: '^5.9.2', section: 'devDependencies' },
  { name: 'tsdown', version: '^0.18.3', section: 'devDependencies' },
  { name: 'vitest', version: '^4.0.16', section: 'devDependencies' },
  { name: 'simple-git-hooks', version: '^2.13.1', section: 'devDependencies' },
  { name: 'lint-staged', version: '^16.2.7', section: 'devDependencies' },

  // eslint stack
  { name: 'eslint', version: '^9.39.2', section: 'devDependencies' },
  { name: '@eslint/js', version: '^9.39.2', section: 'devDependencies' },
  { name: 'eslint-plugin-markdownlint', version: '^0.9.0', section: 'devDependencies' },
  { name: '@stylistic/eslint-plugin', version: '^5.6.1', section: 'devDependencies' },
  { name: '@typescript-eslint/parser', version: '^8.51.0', section: 'devDependencies' },
  { name: '@typescript-eslint/eslint-plugin', version: '^8.51.0', section: 'devDependencies' },
  { name: 'typescript-eslint', version: '^8.51.0', section: 'devDependencies' },
  { name: 'eslint-plugin-markdownlint', version: '^0.9.0', section: 'devDependencies' },
  { name: 'eslint-plugin-simple-import-sort', version: '^12.1.1', section: 'devDependencies' },

  // finografic ecosystem
  { name: '@finografic/project-scripts', version: '^8.2.0', section: 'devDependencies' },
];
