import { describe, expect, it } from 'vitest';

import { UPGRADE_ONLY_SECTIONS } from 'types/upgrade.types';

import { applyMergesRider } from './upgrade-operations.prompt.js';

describe('upgrade operations', () => {
  it('has no hooks section — the gitHooks feature owns those files', () => {
    // Two writers for `.husky/*` and `commitlint.config.mjs` meant two sources for one file, and the
    // operation overwrote without showing a diff. Reinstating it would restore that.
    expect(UPGRADE_ONLY_SECTIONS).not.toContain('hooks');
  });

  it('has no oxc-config section — that is a feature, not an operation', () => {
    expect(UPGRADE_ONLY_SECTIONS).not.toContain('oxc-config');
  });

  it('keeps merges in the section list even though the menu never offers it', () => {
    // `merges` is not a menu entry; it is added by the prompt whenever `package-json` is selected.
    // Dropping it from the section list would make `shouldRunSection` reject a value that is still
    // produced, silently disabling the package.json template merge.
    expect(UPGRADE_ONLY_SECTIONS).toContain('merges');
  });

  it('adds merges when package-json is selected, and not otherwise', () => {
    expect(applyMergesRider(['package-json', 'docs'])).toEqual(['package-json', 'docs', 'merges']);
    expect(applyMergesRider(['docs'])).toEqual(['docs']);
  });
});
