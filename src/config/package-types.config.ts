import type { PackageType } from 'types/package-type.types';

/**
 * Available package types for the create command.
 */
export const PACKAGE_TYPES: PackageType[] = [
  {
    id: 'library',
    label: 'Library',
    description: 'reusable TypeScript library',
    packageJsonDefaults: {},
    entryPoints: ['src/index.ts'],
    keywords: ['library'],
    defaultFeatures: ['vitest'],
    eslint: { globals: ['node'] },
  },
  {
    id: 'cli',
    label: 'CLI',
    description: 'command-line tool',
    packageJsonDefaults: {
      bin: { __PKG_NAME__: './dist/index.mjs' },
    },
    entryPoints: ['src/cli.ts'],
    keywords: ['cli'],
    scripts: {
      'dev.cli': 'NODE_ENV=development tsx src/cli.ts --',
    },
    defaultFeatures: ['vitest'],
    eslint: { globals: ['node'] },
  },
  {
    id: 'config',
    label: 'Config',
    description: 'shared configuration package',
    packageJsonDefaults: {},
    entryPoints: ['src/index.ts'],
    keywords: ['config', 'shared-config'],
    defaultFeatures: [],
    eslint: { globals: ['node'] },
  },
];
