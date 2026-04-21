import { describe, expect, it } from 'vitest';

import type { DependencyRule } from 'types/dependencies.types';
import type { PackageJson } from 'types/package-json.types';

import { planDependencyChanges } from './dependencies.utils.js';

function rule(
  name: string,
  version: string,
  section: DependencyRule['section'] = 'devDependencies',
): DependencyRule {
  return { name, version, section };
}

describe('planDependencyChanges', () => {
  it('omits changes when the current version already satisfies the policy range', () => {
    const pkg: PackageJson = {
      name: '@finografic/test',
      version: '0.0.0',
      devDependencies: { '@types/node': '24.0.0' },
    };
    const changes = planDependencyChanges(pkg, [rule('@types/node', '^24.0.0')]);
    expect(changes).toEqual([]);
  });

  it('omits changes when a caret range already satisfies a wider policy', () => {
    const pkg: PackageJson = {
      name: '@finografic/test',
      version: '0.0.0',
      devDependencies: { oxlint: '^1.61.0' },
    };
    const changes = planDependencyChanges(pkg, [rule('oxlint', '^1.0.0')]);
    expect(changes).toEqual([]);
  });

  it('plans an upgrade when policy requires a newer floor', () => {
    const pkg: PackageJson = {
      name: '@finografic/test',
      version: '0.0.0',
      devDependencies: { typescript: '~5.6.0' },
    };
    const changes = planDependencyChanges(pkg, [rule('typescript', '^5.7.0')]);
    expect(changes).toEqual([
      expect.objectContaining({
        name: 'typescript',
        from: '~5.6.0',
        to: '^5.7.0',
        operation: 'upgrade',
      }),
    ]);
  });

  it('omits downgrades by default when policy is older than the current spec', () => {
    const pkg: PackageJson = {
      name: '@finografic/test',
      version: '0.0.0',
      devDependencies: { oxfmt: '^0.44.0' },
    };
    const changes = planDependencyChanges(pkg, [rule('oxfmt', '^0.43.0')]);
    expect(changes).toEqual([]);
  });

  it('includes downgrades when allowDowngrade is true', () => {
    const pkg: PackageJson = {
      name: '@finografic/test',
      version: '0.0.0',
      devDependencies: { oxfmt: '^0.44.0' },
    };
    const changes = planDependencyChanges(pkg, [rule('oxfmt', '^0.43.0')], { allowDowngrade: true });
    expect(changes).toEqual([
      expect.objectContaining({
        name: 'oxfmt',
        from: '^0.44.0',
        to: '^0.43.0',
        operation: 'downgrade',
      }),
    ]);
  });

  it('still uses string inequality for non-semver protocol specs', () => {
    const pkg: PackageJson = {
      name: '@finografic/test',
      version: '0.0.0',
      devDependencies: { foo: 'workspace:*' },
    };
    const changes = planDependencyChanges(pkg, [rule('foo', '^1.0.0')]);
    expect(changes).toHaveLength(1);
    expect(changes[0]?.operation).toBe('upgrade');
  });
});
