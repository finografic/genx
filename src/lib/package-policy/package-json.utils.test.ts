import { describe, expect, it } from 'vitest';

import { sharedConfig } from 'config/shared.config';
import type { PackageJson } from 'types/package-json.types';

import { patchPackageJson } from './package-json.utils.js';

/**
 * `patchPackageJson` ensures rather than enforces: a key the project already defines is its own
 * business. Overwriting on difference silently replaced deliberate project decisions with defaults.
 */
describe('patchPackageJson scripts', () => {
  it('leaves an existing script exactly as the project wrote it', () => {
    // The reported case: a React app whose prepare step also runs its CSS codegen.
    const pkg: PackageJson = { name: 'x', scripts: { prepare: 'husky && pnpm panda:codegen' } };

    const { packageJson, changes } = patchPackageJson(pkg, 'x');

    expect(packageJson.scripts?.prepare).toBe('husky && pnpm panda:codegen');
    expect(changes).not.toContain('scripts.prepare');
  });

  it('does not strip a project step out of release:check', () => {
    const pkg: PackageJson = {
      name: 'x',
      scripts: { 'release:check': 'pnpm format:check && pnpm lint:fix && pnpm typecheck' },
    };

    const { packageJson } = patchPackageJson(pkg, 'x');

    expect(packageJson.scripts?.['release:check']).toContain('format:check');
  });

  it('still adds a script the project does not have', () => {
    const { packageJson, changes } = patchPackageJson({ name: 'x', scripts: {} }, 'x');

    expect(packageJson.scripts?.typecheck).toBe('tsc --project tsconfig.json --noEmit');
    expect(changes).toContain('scripts.typecheck');
  });

  it('adds no vitest scripts — the vitest feature owns those', () => {
    // They were added to every package, in the wrong place, whether or not vitest was selected.
    const { packageJson } = patchPackageJson({ name: 'x', scripts: {} }, 'x');

    expect(packageJson.scripts).not.toHaveProperty('test');
    expect(packageJson.scripts).not.toHaveProperty('test:run');
    expect(packageJson.scripts).not.toHaveProperty('test:coverage');
  });
});

describe('patchPackageJson lint-staged', () => {
  it('leaves an existing pattern alone', () => {
    const pkg: PackageJson = {
      'name': 'x',
      'lint-staged': { '*.{json,jsonc,yml,yaml,toml}': ['some-project-formatter'] },
    };

    const { packageJson } = patchPackageJson(pkg, 'x');

    expect(packageJson['lint-staged']?.['*.{json,jsonc,yml,yaml,toml}']).toEqual(['some-project-formatter']);
  });

  it('never claims *.md — the markdown feature writes md-lint there', () => {
    // Claiming it replaced `md-lint --fix` with oxlint on every upgrade, switching markdown
    // linting off in repositories that had it.
    expect(sharedConfig.lintStaged).not.toHaveProperty('*.md');

    const { packageJson } = patchPackageJson({ name: 'x' }, 'x');
    expect(packageJson['lint-staged']).not.toHaveProperty('*.md');
  });
});
