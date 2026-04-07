import { policy } from '@finografic/deps-policy';

export const VITEST_PACKAGE = 'vitest';
export const VITEST_PACKAGE_VERSION = policy.base.devDependencies?.['vitest'] ?? 'latest';

export const TESTING_SECTION_TITLE = '·········· TESTING';
export const TEST_SCRIPTS = {
  'test': 'vitest',
  'test:run': 'vitest run',
  'test:coverage': 'vitest run --coverage',
};
