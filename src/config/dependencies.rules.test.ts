import { describe, expect, it } from 'vitest';

import { dependencyRules } from './dependencies.rules.js';

function ruleFor(name: string) {
  return dependencyRules.find((rule) => rule.name === name);
}

/**
 * A non-optional rule is force-added to any package that lacks it. That is right for the toolchain
 * every `@finografic` package shares, and wrong for anything a project opts into — adding a second
 * bundler or a test runner nobody asked for is not an alignment.
 */
describe('dependency rules', () => {
  it.each(['vitest', 'tsdown', '@finografic/project-scripts'])('never force-adds %s', (name) => {
    expect(ruleFor(name)?.optional).toBe(true);
  });

  it('still force-aligns the shared toolchain', () => {
    expect(ruleFor('typescript')?.optional).toBeUndefined();
    expect(ruleFor('husky')?.optional).toBeUndefined();
    expect(ruleFor('lint-staged')?.optional).toBeUndefined();
  });
});
