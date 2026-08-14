import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runCheck } from './check.runner.js';
import { runPull } from './pull.runner.js';
import { runPush } from './push.runner.js';
import { runRender } from './render.runner.js';

const FIXTURES = join(fileURLToPath(new URL('.', import.meta.url)), '../../../../test/fixtures/design-md');

describe('design sync --pull / check (tailwind4 e2e)', () => {
  let workDir: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'genx-design-'));
    cpSync(join(FIXTURES, 'tailwind4-project'), workDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it('creates DESIGN.md, is idempotent, and check passes then fails on drift', async () => {
    // First pull creates DESIGN.md (yes: applies without prompting).
    const first = await runPull(workDir, { yes: true });
    expect(first.status).toBe('applied');

    const content = readFileSync(join(workDir, 'DESIGN.md'), 'utf8');
    expect(content).toContain('source-of-truth: design-system');
    expect(content).toContain('primary: "#1a1c1e"');
    expect(content).toContain('## Source of Truth');

    // Second pull is a no-op.
    const second = await runPull(workDir, { yes: true });
    expect(second.status).toBe('up-to-date');
    expect(readFileSync(join(workDir, 'DESIGN.md'), 'utf8')).toBe(content);

    // In sync → exit 0.
    const clean = await runCheck(workDir, {});
    expect(clean.exitCode).toBe(0);

    // Seed drift in the design system → exit 1 with a modified finding.
    const cssPath = join(workDir, 'src/app.css');
    writeFileSync(cssPath, readFileSync(cssPath, 'utf8').replace('#1a1c1e', '#222222'), 'utf8');
    const drifted = await runCheck(workDir, {});
    expect(drifted.exitCode).toBe(1);
    expect(drifted.report?.groups.colors?.modified).toEqual([
      { token: 'primary', current: '#1a1c1e', expected: '#222222' },
    ]);
  });

  it('preserves a hand-edited body across pulls', async () => {
    await runPull(workDir, { yes: true });

    const designMdPath = join(workDir, 'DESIGN.md');
    const edited = readFileSync(designMdPath, 'utf8').replace(
      '## Overview',
      '## Overview\n\nHand-written product personality prose.\n',
    );
    writeFileSync(designMdPath, edited, 'utf8');

    // Drift the design system, pull again — prose must survive.
    const cssPath = join(workDir, 'src/app.css');
    writeFileSync(cssPath, readFileSync(cssPath, 'utf8').replace('#1a1c1e', '#333333'), 'utf8');
    const result = await runPull(workDir, { yes: true });
    expect(result.status).toBe('applied');

    const after = readFileSync(designMdPath, 'utf8');
    expect(after).toContain('Hand-written product personality prose.');
    expect(after).toContain('primary: "#333333"');
  });

  it('refuses to pull over a DESIGN.md that declares itself canonical', async () => {
    writeFileSync(
      join(workDir, 'DESIGN.md'),
      '---\nname: X\nsource-of-truth: design-md\ncolors:\n  primary: "#000000"\n---\n\n# Design System\n',
      'utf8',
    );
    const result = await runPull(workDir, { yes: true });
    expect(result.status).toBe('error');
    expect(result.message).toContain('canonical');
  });

  it('render adds the artifact to an existing .gitignore', async () => {
    await runPull(workDir, { yes: true });
    writeFileSync(join(workDir, '.gitignore'), 'node_modules\n', 'utf8');

    const result = await runRender(workDir, { yes: true });
    expect(result.exitCode).toBe(0);
    expect(readFileSync(join(workDir, '.gitignore'), 'utf8')).toContain('DESIGN.html');
    // Already listed on a second run: the file is not rewritten, and the
    // message drops the hint.
    expect((await runRender(workDir, { yes: true })).message).not.toContain('consider gitignoring');
  });

  it('render leaves a project without a .gitignore alone', async () => {
    await runPull(workDir, { yes: true });
    const result = await runRender(workDir, { yes: true });
    expect(result.exitCode).toBe(0);
    expect(existsSync(join(workDir, '.gitignore'))).toBe(false);
    expect(result.message).toContain('consider gitignoring');
  });

  it('push refuses when DESIGN.md does not declare itself canonical', async () => {
    await runPull(workDir, { yes: true }); // creates a design-system-canonical DESIGN.md
    const result = await runPush(workDir, {});
    expect(result.status).toBe('error');
    expect(result.message).toContain('sync --pull');
  });

  it('push refuses to flatten a shadcn-style @theme built from custom properties', async () => {
    const shadcnDir = mkdtempSync(join(tmpdir(), 'genx-design-shadcn-'));
    try {
      cpSync(join(FIXTURES, 'tailwind4-shadcn-project'), shadcnDir, { recursive: true });
      await runPull(shadcnDir, { yes: true });
      const designMdPath = join(shadcnDir, 'DESIGN.md');
      writeFileSync(
        designMdPath,
        readFileSync(designMdPath, 'utf8').replace(
          'source-of-truth: design-system',
          'source-of-truth: design-md',
        ),
        'utf8',
      );

      const result = await runPush(shadcnDir, {});
      expect(result.status).toBe('error');
      expect(result.message).toContain('--color-background');
      expect(result.message).toContain('dark mode');
      // The stylesheet is untouched: the indirection layer survives.
      expect(readFileSync(join(shadcnDir, 'src/app.css'), 'utf8')).toContain(
        '--color-primary: var(--primary);',
      );
    } finally {
      rmSync(shadcnDir, { recursive: true, force: true });
    }
  });

  it('push reports up-to-date when the design system already matches (no prompt reached)', async () => {
    await runPull(workDir, { yes: true });
    const designMdPath = join(workDir, 'DESIGN.md');
    const flipped = readFileSync(designMdPath, 'utf8').replace(
      'source-of-truth: design-system',
      'source-of-truth: design-md',
    );
    writeFileSync(designMdPath, flipped, 'utf8');
    // Tokens were just pulled from the design system, so pushing them back is a no-op.
    const result = await runPush(workDir, {});
    expect(result.status).toBe('up-to-date');
  });
});
