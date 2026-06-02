import { describe, expect, it } from 'vitest';

import { parseJsoncObject } from './jsonc.utils.js';
import { normalizeVSCodeSettingsObject, renderGroupedVSCodeSettingsJson } from './vscode-settings.render.js';

describe('vscode-settings.render', () => {
  it('renders the template settings in canonical grouped order', () => {
    const template = `{
  "npm.packageManager": "pnpm",

  "editor.formatOnSave": true,
  "editor.formatOnSaveMode": "file",
  "editor.defaultFormatter": "oxc.oxc-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.oxc": "explicit",
    "source.organizeImports": "never",
    "source.sortImports": "explicit",
    "source.addMissingImports": "explicit"
  },

  "eslint.enable": false,
  "prettier.enable": false,

  "oxc.typeAware": true,
  "oxc.lint.run": "onSave",

  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.preferences.preferTypeOnlyAutoImports": true,

  "[javascript]": {
    "editor.defaultFormatter": "oxc.oxc-vscode"
  },
  "[typescript]": {
    "editor.defaultFormatter": "oxc.oxc-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "oxc.oxc-vscode"
  },
  "[jsonc]": {
    "editor.defaultFormatter": "oxc.oxc-vscode"
  },
  "[yaml]": {
    "editor.defaultFormatter": "oxc.oxc-vscode"
  },
  "[toml]": {
    "editor.defaultFormatter": "oxc.oxc-vscode"
  },
  "[markdown]": {
    "editor.defaultFormatter": "oxc.oxc-vscode",
    "editor.formatOnSave": true
  },

  "markdown.styles": ["node_modules/@finografic/md-lint/styles/markdown-github-light.css"]
}
`;

    const parsed = parseJsoncObject(template);
    const rendered = renderGroupedVSCodeSettingsJson(parsed, {
      languageOrder: ['javascript', 'typescript', 'json', 'jsonc', 'yaml', 'toml', 'markdown'],
    });

    expect(rendered).toBe(template);
  });

  it('prunes deprecated keys and places unknown roots before markdown', () => {
    const rendered = renderGroupedVSCodeSettingsJson(
      normalizeVSCodeSettingsObject(
        {
          'npm.packageManager': 'pnpm',
          'dprint.verbose': true,
          'eslint.enable': false,
          'eslint.format.enable': true,
          'custom.setting': 'keep',
          '[typescript]': { 'editor.defaultFormatter': 'oxc.oxc-vscode' },
          'markdown.styles': ['a.css'],
        },
        {
          pruneExactKeys: ['eslint.format.enable'],
          prunePrefixes: ['dprint.'],
        },
      ),
      { languageOrder: ['typescript'] },
    );

    expect(rendered).not.toContain('dprint.verbose');
    expect(rendered).not.toContain('eslint.format.enable');
    expect(rendered).toContain('"custom.setting": "keep"');
    expect(rendered.indexOf('"custom.setting"')).toBeLessThan(rendered.indexOf('"markdown.styles"'));
  });
});
