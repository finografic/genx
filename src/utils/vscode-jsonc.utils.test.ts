import { describe, expect, it } from 'vitest';

import { ensureOxfmtSharedSettingsBeforePrettier } from './vscode-jsonc.utils';

describe('vscode-jsonc.utils — preserves comments in untouched regions', () => {
  it('keeps // comments inside markdownlint.config when adding oxfmt globals', () => {
    const raw = `{
  "markdownlint.config": {
    "MD013": false, // line comment
    "MD024": false
  },

  "prettier.enable": true
}
`;
    const { text } = ensureOxfmtSharedSettingsBeforePrettier(raw, 'oxc.oxc-vscode');
    expect(text).toContain('// line comment');
    expect(text).toContain('"MD024": false');
    expect(text).toContain('"prettier.enable": false');
    expect(text).toContain('"oxc.typeAware": true');
  });
});
