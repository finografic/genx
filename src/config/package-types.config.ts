import type { PackageType } from 'types/package-type.types';

/**
 * Available package types for the create command.
 */
export const PACKAGE_TYPES: PackageType[] = [
  {
    id: 'library',
    label: 'Library',
    description: 'A reusable TypeScript library',
    packageJsonDefaults: {},
    entryPoints: ['src/index.ts'],
    keywords: ['library'],
    defaultFeatures: ['vitest'],
  },
  {
    id: 'cli',
    label: 'CLI',
    description: 'A command-line tool',
    packageJsonDefaults: {
      bin: { __PKG_NAME__: './dist/index.mjs' },
    },
    entryPoints: ['src/cli.ts'],
    keywords: ['cli'],
    defaultFeatures: ['vitest'],
  },
  {
    id: 'config',
    label: 'Config',
    description: 'A shared configuration package',
    packageJsonDefaults: {},
    entryPoints: ['src/index.ts'],
    keywords: ['config', 'shared-config'],
    defaultFeatures: [],
  },
];
