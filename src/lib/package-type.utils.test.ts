import { describe, expect, it } from 'vitest';

import { inferPackageTypeId, isFrontendPackageType, isPackageType } from './package-type.utils.js';

describe('package-type.utils', () => {
  it('prefers explicit genx package type keywords', () => {
    expect(
      inferPackageTypeId({
        name: '@finografic/some-tool',
        keywords: ['react', 'vite', 'genx:type:cli'],
        dependencies: { react: '^19.0.0', vite: '^7.0.0' },
      }),
    ).toBe('cli');
  });

  it('infers cli from bin when no explicit package type keyword exists', () => {
    const packageJson = {
      name: '@finografic/my-tool',
      bin: { 'my-tool': './dist/index.mjs' },
    };

    expect(inferPackageTypeId(packageJson)).toBe('cli');
    expect(isPackageType(packageJson, 'cli')).toBe(true);
  });

  it('infers react from React and Vite dependencies', () => {
    const packageJson = {
      name: '@finografic/my-app',
      dependencies: {
        'react': '^19.0.0',
        'react-dom': '^19.0.0',
      },
      devDependencies: {
        'vite': '^7.0.0',
        '@vitejs/plugin-react': '^5.0.0',
      },
    };

    expect(inferPackageTypeId(packageJson)).toBe('react');
    expect(isFrontendPackageType(inferPackageTypeId(packageJson))).toBe(true);
  });

  it('infers config from shared-config style keywords', () => {
    const packageJson = {
      name: '@finografic/ts-config',
      keywords: ['config', 'shared-config'],
    };

    expect(inferPackageTypeId(packageJson)).toBe('config');
    expect(isPackageType(packageJson, 'config')).toBe(true);
  });

  it('falls back to library when no stronger signal exists', () => {
    const packageJson = {
      name: '@finografic/core-utils',
      keywords: ['finografic'],
    };

    expect(inferPackageTypeId(packageJson)).toBe('library');
    expect(isPackageType(packageJson, 'library')).toBe(true);
  });
});
