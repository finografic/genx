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
      'dev:cli': 'NODE_ENV=development tsx src/cli.ts --',
    },
    defaultFeatures: ['vitest'],
  },
  {
    id: 'config',
    label: 'Config',
    description: 'shared configuration package',
    packageJsonDefaults: {},
    entryPoints: ['src/index.ts'],
    keywords: ['config', 'shared-config'],
    defaultFeatures: [],
  },
  {
    id: 'react',
    label: 'React',
    description: 'Vite + React + TypeScript app',
    packageJsonDefaults: {},
    entryPoints: ['src/main.tsx'],
    keywords: ['react', 'vite'],
    scripts: {
      'dev': 'concurrently -n panda,vite "pnpm panda:watch" "vite"',
      'build': 'pnpm panda:codegen && tsc --project tsconfig.json && vite build',
      'preview': 'vite preview',
      'panda:watch': 'panda --watch',
      'panda:codegen': 'panda codegen',
      'panda:clean': 'panda codegen --clean',
    },
    defaultFeatures: ['vitest', 'gitHooks'],
    templateOverlayDir: 'package-types/react',
  },
];
