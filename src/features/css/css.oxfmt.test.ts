import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { OXFMT_CONFIG_FILENAME } from './css.constants';
import {
  ensureCssImportInOxfmtConfig,
  insertCssOverrideInOxfmtConfig,
  patchOxfmtConfigForCss,
} from './css.oxfmt';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const baseTemplateOxfmtConfig = readFileSync(join(repoRoot, '_templates/oxfmt.config.ts'), 'utf8');

describe('css.oxfmt — ensureCssImportInOxfmtConfig', () => {
  it('inserts css import after base when missing', () => {
    const out = ensureCssImportInOxfmtConfig(baseTemplateOxfmtConfig);
    expect(out).toMatch(/\n {2}base,\n {2}css,\n {2}ignorePatterns,/);
    expect(out).not.toBe(baseTemplateOxfmtConfig);
  });

  it('is a no-op when css is already imported', () => {
    const withCss = ensureCssImportInOxfmtConfig(baseTemplateOxfmtConfig);
    const again = ensureCssImportInOxfmtConfig(withCss);
    expect(again).toBe(withCss);
  });

  it('does nothing when @finografic/oxfmt-config is not imported', () => {
    const noOxfmt = `export default { foo: 1 };`;
    expect(ensureCssImportInOxfmtConfig(noOxfmt)).toBe(noOxfmt);
  });
});

describe('css.oxfmt — insertCssOverrideInOxfmtConfig', () => {
  it('appends CSS/SCSS override after agentMarkdown block (genx template)', () => {
    const withImport = ensureCssImportInOxfmtConfig(baseTemplateOxfmtConfig);
    const out = insertCssOverrideInOxfmtConfig(withImport);

    expect(out).toContain("files: ['*.css', '*.scss']");
    expect(out).toContain('options: { ...css }');
    expect(out).toContain('excludeFiles: []');
    expect(out).not.toBe(withImport);
  });

  it('is a no-op when the override already exists', () => {
    const patched = insertCssOverrideInOxfmtConfig(ensureCssImportInOxfmtConfig(baseTemplateOxfmtConfig));
    const again = insertCssOverrideInOxfmtConfig(patched);
    expect(again).toBe(patched);
  });
});

describe('css.oxfmt — full patch (import + override)', () => {
  it('matches expected shape vs base _templates/oxfmt.config.ts', () => {
    let next = ensureCssImportInOxfmtConfig(baseTemplateOxfmtConfig);
    next = insertCssOverrideInOxfmtConfig(next);

    expect(next).toMatch(/import\s*\{[^}]*\bcss\b[^}]*\}\s*from\s*['"]@finografic\/oxfmt-config['"]/s);
    expect(next).toContain(`{ files: ['*.css', '*.scss'], excludeFiles: [], options: { ...css } }`);
    expect(next.split('{ files:').filter((s) => s.includes('*.css')).length).toBe(1);
  });
});

describe('css.oxfmt — patchOxfmtConfigForCss', () => {
  it('returns false when oxfmt.config.ts is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'genx-css-oxfmt-empty-'));
    try {
      await expect(patchOxfmtConfigForCss(dir)).resolves.toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('writes css import + override and returns true once; second run is no-op', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'genx-css-oxfmt-patch-'));
    const configPath = join(dir, OXFMT_CONFIG_FILENAME);

    try {
      await writeFile(configPath, baseTemplateOxfmtConfig, 'utf8');

      await expect(patchOxfmtConfigForCss(dir)).resolves.toBe(true);

      const once = await readFile(configPath, 'utf8');
      expect(once).toContain('css,');
      expect(once).toContain("files: ['*.css', '*.scss']");

      await expect(patchOxfmtConfigForCss(dir)).resolves.toBe(false);

      const twice = await readFile(configPath, 'utf8');
      expect(twice).toBe(once);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
