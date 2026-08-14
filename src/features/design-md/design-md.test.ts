import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPull } from 'commands/design/lib/pull.runner';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { applyDesignMd } from './design-md.apply.js';
import { auditDesignMd, isDesignMdApplicable } from './design-md.detect.js';

const FIXTURES = join(fileURLToPath(new URL('.', import.meta.url)), '../../../test/fixtures/design-md');

describe('design-md feature', () => {
  let workDir: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'genx-design-md-feature-'));
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it('is not applicable to a project with no design system and no DESIGN.md', () => {
    expect(isDesignMdApplicable({ targetDir: workDir })).toBe(false);
  });

  it('is applicable once a design system is present', () => {
    cpSync(join(FIXTURES, 'tailwind4-project'), workDir, { recursive: true });
    expect(isDesignMdApplicable({ targetDir: workDir })).toBe(true);
  });

  it('reports missing before a DESIGN.md exists, pointing at the skill', async () => {
    cpSync(join(FIXTURES, 'tailwind4-project'), workDir, { recursive: true });
    const result = await auditDesignMd({ targetDir: workDir });
    expect(result.status).toBe('missing');
    expect(result.detail).toContain('generate-design-md');
  });

  it('reports installed when the mirror matches, partial once it drifts', async () => {
    cpSync(join(FIXTURES, 'tailwind4-project'), workDir, { recursive: true });
    await runPull(workDir, { yes: true });
    expect((await auditDesignMd({ targetDir: workDir })).status).toBe('installed');

    const designMdPath = join(workDir, 'DESIGN.md');
    writeFileSync(designMdPath, readFileSync(designMdPath, 'utf8').replace('#1a1c1e', '#000000'), 'utf8');
    const drifted = await auditDesignMd({ targetDir: workDir });
    expect(drifted.status).toBe('partial');
    expect(drifted.detail).toContain('out of date');
  });

  it('refreshes a drifted mirror on apply', async () => {
    cpSync(join(FIXTURES, 'tailwind4-project'), workDir, { recursive: true });
    await runPull(workDir, { yes: true });
    const designMdPath = join(workDir, 'DESIGN.md');
    writeFileSync(designMdPath, readFileSync(designMdPath, 'utf8').replace('#1a1c1e', '#000000'), 'utf8');

    const result = await applyDesignMd({ targetDir: workDir, yesAll: true });
    expect(result.applied).toEqual(['DESIGN.md']);
    expect(readFileSync(designMdPath, 'utf8')).toContain('#1a1c1e');
  });

  it('never authors a DESIGN.md, even with yesAll', async () => {
    cpSync(join(FIXTURES, 'tailwind4-project'), workDir, { recursive: true });
    const result = await applyDesignMd({ targetDir: workDir, yesAll: true });
    expect(result.applied).toEqual([]);
    expect(result.noopMessage).toContain('generate-design-md');
  });
});
