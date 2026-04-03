import { describe, expect, it } from 'vitest';

import {
  ensureMarkdownlintConfigAndStylesAtEnd,
  ensureOxfmtSharedSettingsBeforePrettier,
} from './vscode-jsonc.utils';

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

describe('ensureMarkdownlintConfigAndStylesAtEnd', () => {
  it('moves markdownlint + styles to the final two root properties', () => {
    const raw = `{
  "markdown.styles": ["a.css"],
  "a": 1,
  "markdownlint.config": { "MD013": false, // keep
  }
}
`;
    const { text, changed } = ensureMarkdownlintConfigAndStylesAtEnd(raw);
    expect(changed).toBe(true);
    expect(text.indexOf('"markdownlint.config"')).toBeGreaterThan(text.indexOf('"a"'));
    expect(text.lastIndexOf('"markdown.styles"')).toBeGreaterThan(text.lastIndexOf('"markdownlint.config"'));
    expect(text).toContain('// keep');
  });
});
