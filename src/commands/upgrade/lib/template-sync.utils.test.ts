import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { TemplateVars } from 'types/template.types';
import type { UpgradeOnlySection } from 'types/upgrade.types';

import { differsOnlyByTrailingNewline, syncFromTemplate } from './template-sync.utils.js';

const vars: TemplateVars = {
  SCOPE: '@finografic',
  NAME: 'x',
  PACKAGE_NAME: '@finografic/x',
  YEAR: '2026',
  DESCRIPTION: '',
  AUTHOR_NAME: 'Test',
  AUTHOR_EMAIL: 'test@example.com',
};

/** Non-interactive: yes-to-all renders diffs but never prompts. */
const writeAll = { yesAll: true };

async function createTemplateDir(): Promise<string> {
  const templateDir = await mkdtemp(join(tmpdir(), 'genx-tmpl-'));
  await mkdir(join(templateDir, '.github/workflows'), { recursive: true });
  await writeFile(join(templateDir, '.github/workflows/ci.yml'), 'name: CI\n');
  await writeFile(join(templateDir, '.github/workflows/release.yml'), 'name: Release\n');
  return templateDir;
}

describe('differsOnlyByTrailingNewline', () => {
  it('recognises a file saved without a newline at end of file', () => {
    expect(differsOnlyByTrailingNewline('a=1', 'a=1\n')).toBe(true);
    expect(differsOnlyByTrailingNewline('a=1\n\n', 'a=1\n')).toBe(true);
  });

  it('is false for identical content and for a real change', () => {
    expect(differsOnlyByTrailingNewline('a=1\n', 'a=1\n')).toBe(false);
    expect(differsOnlyByTrailingNewline('a=1\n', 'a=2\n')).toBe(false);
    expect(differsOnlyByTrailingNewline('', 'a=1\n')).toBe(false);
  });
});

describe('syncFromTemplate', () => {
  it('adds a missing newline at end of file without prompting', async () => {
    // `.npmrc` differed from the template by one byte, and asked about it on every single run.
    const templateDir = await mkdtemp(join(tmpdir(), 'genx-tmpl-'));
    await mkdir(join(templateDir, '.github/workflows'), { recursive: true });
    await writeFile(join(templateDir, '.github/workflows/ci.yml'), 'name: CI\n');
    await writeFile(join(templateDir, '.github/workflows/release.yml'), 'name: Release\n');
    const targetDir = await mkdtemp(join(tmpdir(), 'genx-sync-'));
    await mkdir(join(targetDir, '.github/workflows'), { recursive: true });
    await writeFile(join(targetDir, '.github/workflows/ci.yml'), 'name: CI');
    await writeFile(join(targetDir, '.github/workflows/release.yml'), 'name: Release\n');

    // No diff state at all: a prompt here would hang rather than resolve.
    await syncFromTemplate(targetDir, templateDir, vars, new Set<UpgradeOnlySection>(['workflows']), {});

    await expect(readFile(join(targetDir, '.github/workflows/ci.yml'), 'utf8')).resolves.toBe('name: CI\n');

    await rm(templateDir, { recursive: true, force: true });
    await rm(targetDir, { recursive: true, force: true });
  });

  it('writes a missing file', async () => {
    const templateDir = await createTemplateDir();
    const targetDir = await mkdtemp(join(tmpdir(), 'genx-sync-'));

    await syncFromTemplate(
      targetDir,
      templateDir,
      vars,
      new Set<UpgradeOnlySection>(['workflows']),
      {},
      writeAll,
    );

    await expect(readFile(join(targetDir, '.github/workflows/ci.yml'), 'utf8')).resolves.toBe('name: CI\n');

    await rm(templateDir, { recursive: true, force: true });
    await rm(targetDir, { recursive: true, force: true });
  });

  it('does not rewrite a file that already matches the template', async () => {
    // The old sync copied over the top every run, so an aligned repository still churned its files.
    // Now an identical file is skipped before any prompt or write — proven by an untouched mtime.
    const templateDir = await createTemplateDir();
    const targetDir = await mkdtemp(join(tmpdir(), 'genx-sync-'));
    const ciPath = join(targetDir, '.github/workflows/ci.yml');
    await mkdir(join(targetDir, '.github/workflows'), { recursive: true });
    await writeFile(ciPath, 'name: CI\n');
    await writeFile(join(targetDir, '.github/workflows/release.yml'), 'name: Release\n');

    const before = (await stat(ciPath)).mtimeMs;

    await syncFromTemplate(
      targetDir,
      templateDir,
      vars,
      new Set<UpgradeOnlySection>(['workflows']),
      {},
      writeAll,
    );

    expect((await stat(ciPath)).mtimeMs).toBe(before);
    await expect(readFile(ciPath, 'utf8')).resolves.toBe('name: CI\n');

    await rm(templateDir, { recursive: true, force: true });
    await rm(targetDir, { recursive: true, force: true });
  });

  it('never copies editor and OS droppings out of the template', async () => {
    // `_templates/docs/.DS_Store` existed and was copied into every target the docs sync touched.
    const templateDir = await mkdtemp(join(tmpdir(), 'genx-tmpl-'));
    await mkdir(join(templateDir, 'docs/process'), { recursive: true });
    await writeFile(join(templateDir, 'docs/.DS_Store'), 'junk');
    await writeFile(join(templateDir, 'docs/process/GUIDE.md'), '# Guide\n');
    await writeFile(join(templateDir, '.env.example'), 'KEY=\n');
    const targetDir = await mkdtemp(join(tmpdir(), 'genx-sync-'));

    await syncFromTemplate(targetDir, templateDir, vars, new Set<UpgradeOnlySection>(['docs']), {}, writeAll);

    await expect(readFile(join(targetDir, 'docs/process/GUIDE.md'), 'utf8')).resolves.toBe('# Guide\n');
    expect(existsSync(join(targetDir, 'docs/.DS_Store'))).toBe(false);

    await rm(templateDir, { recursive: true, force: true });
    await rm(targetDir, { recursive: true, force: true });
  });

  it('omits docs/spec for a package that is not a CLI', async () => {
    const templateDir = await mkdtemp(join(tmpdir(), 'genx-tmpl-'));
    await mkdir(join(templateDir, 'docs/spec'), { recursive: true });
    await writeFile(join(templateDir, 'docs/spec/CLI_CORE.md'), '# CLI core\n');
    await writeFile(join(templateDir, 'docs/ROADMAP.md'), '# Roadmap\n');
    await writeFile(join(templateDir, '.env.example'), 'KEY=\n');
    const targetDir = await mkdtemp(join(tmpdir(), 'genx-sync-'));

    await syncFromTemplate(
      targetDir,
      templateDir,
      vars,
      new Set<UpgradeOnlySection>(['docs']),
      { name: 'x' },
      writeAll,
    );

    await expect(readFile(join(targetDir, 'docs/ROADMAP.md'), 'utf8')).resolves.toBe('# Roadmap\n');
    expect(existsSync(join(targetDir, 'docs/spec/CLI_CORE.md'))).toBe(false);

    await rm(templateDir, { recursive: true, force: true });
    await rm(targetDir, { recursive: true, force: true });
  });

  it('does nothing when no selected operation owns a template file', async () => {
    const templateDir = await createTemplateDir();
    const targetDir = await mkdtemp(join(tmpdir(), 'genx-sync-'));

    await syncFromTemplate(
      targetDir,
      templateDir,
      vars,
      new Set<UpgradeOnlySection>(['renames']),
      {},
      writeAll,
    );

    expect(existsSync(join(targetDir, '.github/workflows/ci.yml'))).toBe(false);

    await rm(templateDir, { recursive: true, force: true });
    await rm(targetDir, { recursive: true, force: true });
  });
});
