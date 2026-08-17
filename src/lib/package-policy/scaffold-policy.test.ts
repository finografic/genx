import { describe, expect, it } from 'vitest';

import type { PackageJson } from 'types/package-json.types';

import { alignScaffoldDependencies } from './scaffold-policy.utils.js';

const resolved = {
  dependencies: { picocolors: '^1.1.1', zod: '^4.3.4' },
  devDependencies: { typescript: '7.0.2', vitest: '^4.1.10' },
};

describe('alignScaffoldDependencies', () => {
  it('rewrites a declared dependency to the policy version', () => {
    const pkg: PackageJson = { devDependencies: { typescript: '^5.9.3' } };
    const { packageJson, aligned } = alignScaffoldDependencies(pkg, resolved);

    expect(packageJson.devDependencies?.['typescript']).toBe('7.0.2');
    expect(aligned).toEqual([
      { name: 'typescript', from: '^5.9.3', to: '7.0.2', section: 'devDependencies' },
    ]);
  });

  it('never adds a dependency the template did not declare', () => {
    // Feature selection runs after scaffolding — adding vitest here would hand it to someone who
    // declined the vitest feature.
    const pkg: PackageJson = { devDependencies: { typescript: '7.0.2' } };
    const { packageJson } = alignScaffoldDependencies(pkg, resolved);

    expect(packageJson.devDependencies).not.toHaveProperty('vitest');
    expect(Object.keys(packageJson.devDependencies ?? {})).toEqual(['typescript']);
  });

  it('leaves dependencies policy says nothing about untouched', () => {
    const pkg: PackageJson = { dependencies: { 'some-app-dep': '^2.0.0' } };
    const { packageJson, aligned } = alignScaffoldDependencies(pkg, resolved);

    expect(packageJson.dependencies?.['some-app-dep']).toBe('^2.0.0');
    expect(aligned).toEqual([]);
  });

  it('preserves protocol specs rather than replacing them with a range', () => {
    // A workspace:/link: spec is a deliberate override; a version would silently undo it.
    const pkg: PackageJson = {
      dependencies: { picocolors: 'workspace:*' },
      devDependencies: { typescript: 'link:../ts' },
    };
    const { packageJson, aligned } = alignScaffoldDependencies(pkg, resolved);

    expect(packageJson.dependencies?.['picocolors']).toBe('workspace:*');
    expect(packageJson.devDependencies?.['typescript']).toBe('link:../ts');
    expect(aligned).toEqual([]);
  });

  it('reports nothing when the template already matches policy', () => {
    const pkg: PackageJson = { dependencies: { zod: '^4.3.4' } };
    const { aligned } = alignScaffoldDependencies(pkg, resolved);

    expect(aligned).toEqual([]);
  });

  it('aligns both sections in one pass', () => {
    const pkg: PackageJson = {
      dependencies: { zod: '^4.0.0' },
      devDependencies: { typescript: '^5.9.3' },
    };
    const { aligned } = alignScaffoldDependencies(pkg, resolved);

    expect(aligned.map((entry) => entry.section)).toEqual(['dependencies', 'devDependencies']);
  });

  it('does not mutate the input package.json', () => {
    const pkg: PackageJson = { devDependencies: { typescript: '^5.9.3' } };
    alignScaffoldDependencies(pkg, resolved);

    expect(pkg.devDependencies?.['typescript']).toBe('^5.9.3');
  });

  it('handles a package.json with no dependency sections at all', () => {
    const { packageJson, aligned } = alignScaffoldDependencies({}, resolved);

    expect(aligned).toEqual([]);
    expect(packageJson).not.toHaveProperty('dependencies');
  });
});
