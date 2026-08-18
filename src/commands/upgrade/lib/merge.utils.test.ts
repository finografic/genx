import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { confirmFileWrite } from '@finografic/cli-kit/file-diff';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockedFunction } from 'vitest';

import type { MergeRule } from 'config/merge.rules';
import type { TemplateVars } from 'types/template.types';

import { applyMerges, planMerges } from './merge.utils.js';

vi.mock('@finografic/cli-kit/file-diff', () => ({
  confirmFileWrite: vi.fn(),
}));

const confirmFileWriteMock = confirmFileWrite as MockedFunction<typeof confirmFileWrite>;

const VARS: TemplateVars = { SCOPE: '@finografic', NAME: 'x', PACKAGE_NAME: '@finografic/x' };
const RULES: MergeRule[] = [{ file: 'package.json', strategy: 'custom' }];
const EXISTING_FILES = new Set(['package.json']);

/** Write a target and a template package.json into a fresh temp pair of dirs. */
async function makeDirs(target: object, template: object) {
  const targetDir = await mkdtemp(join(tmpdir(), 'genx-merge-target-'));
  const templateDir = await mkdtemp(join(tmpdir(), 'genx-merge-template-'));
  await writeFile(join(targetDir, 'package.json'), `${JSON.stringify(target, null, 2)}\n`);
  await writeFile(join(templateDir, 'package.json'), `${JSON.stringify(template, null, 2)}\n`);
  return { targetDir, templateDir };
}

async function cleanup(...dirs: string[]) {
  for (const dir of dirs) {
    await rm(dir, { recursive: true, force: true });
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  confirmFileWriteMock.mockResolvedValue('write');
});

describe('planMerges', () => {
  it('reports nothing when the merge would not change the file', async () => {
    // The old planner reported a change whenever template and target both existed, so the plan
    // said `merges: package.json` on every run — including runs where nothing would change.
    const { targetDir, templateDir } = await makeDirs(
      { name: 'x', version: '1.0.0', scripts: { build: 'tsdown' } },
      { name: '__PACKAGE_NAME__', version: '0.0.0', scripts: { build: 'tsdown' } },
    );

    const changes = await planMerges(targetDir, EXISTING_FILES, RULES, templateDir, VARS);

    expect(changes).toEqual([]);

    await cleanup(targetDir, templateDir);
  });

  it('reports a change when the template alone reorders keys', async () => {
    // `{ ...template, ...existing }` emits template key order first, so a template that declares
    // only `scripts` hoists it above `name`. Values are untouched, but the file does change —
    // which is why apply now shows the diff instead of writing on a filename list.
    const { targetDir, templateDir } = await makeDirs(
      { name: 'x', version: '1.0.0', scripts: { build: 'tsdown' } },
      { scripts: { build: 'tsdown' } },
    );

    const changes = await planMerges(targetDir, EXISTING_FILES, RULES, templateDir, VARS);

    expect(changes).toEqual([{ file: 'package.json', strategy: 'custom' }]);

    await cleanup(targetDir, templateDir);
  });

  it('reports a change when the template contributes a missing script', async () => {
    const { targetDir, templateDir } = await makeDirs(
      { name: 'x', version: '1.0.0', scripts: { build: 'tsdown' } },
      { scripts: { build: 'tsdown', lint: 'oxlint' } },
    );

    const changes = await planMerges(targetDir, EXISTING_FILES, RULES, templateDir, VARS);

    expect(changes).toEqual([{ file: 'package.json', strategy: 'custom' }]);

    await cleanup(targetDir, templateDir);
  });

  it('reports nothing when the rule has no template file', async () => {
    const { targetDir, templateDir } = await makeDirs({ name: 'x' }, {});
    await rm(join(templateDir, 'package.json'));

    const changes = await planMerges(targetDir, EXISTING_FILES, RULES, templateDir, VARS);

    expect(changes).toEqual([]);

    await cleanup(targetDir, templateDir);
  });
});

describe('applyMerges', () => {
  it('writes a trailing newline', async () => {
    // Without it every merge left package.json newline-less and the next commit's formatter
    // rewrote the file.
    const { targetDir, templateDir } = await makeDirs(
      { name: 'x', version: '1.0.0' },
      { scripts: { lint: 'oxlint' } },
    );

    await applyMerges(targetDir, [{ file: 'package.json', strategy: 'custom' }], templateDir, VARS);

    const written = await readFile(join(targetDir, 'package.json'), 'utf8');
    expect(written.endsWith('}\n')).toBe(true);

    await cleanup(targetDir, templateDir);
  });

  it('keeps the target value when both sides define a script', async () => {
    const { targetDir, templateDir } = await makeDirs(
      { name: 'x', scripts: { build: 'custom-build' } },
      { scripts: { build: 'tsdown', lint: 'oxlint' } },
    );

    await applyMerges(targetDir, [{ file: 'package.json', strategy: 'custom' }], templateDir, VARS);

    const written = JSON.parse(await readFile(join(targetDir, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(written.scripts.build).toBe('custom-build');
    expect(written.scripts.lint).toBe('oxlint');

    await cleanup(targetDir, templateDir);
  });

  it('does not write when the user skips the diff', async () => {
    // package.json used to be written on the strength of a filename list shown before any diff.
    confirmFileWriteMock.mockResolvedValue('skip');
    const original = { name: 'x', version: '1.0.0' };
    const { targetDir, templateDir } = await makeDirs(original, { scripts: { lint: 'oxlint' } });

    const written = await applyMerges(
      targetDir,
      [{ file: 'package.json', strategy: 'custom' }],
      templateDir,
      VARS,
    );

    expect(written).toBe(0);
    const after = JSON.parse(await readFile(join(targetDir, 'package.json'), 'utf8'));
    expect(after).toEqual(original);

    await cleanup(targetDir, templateDir);
  });

  it('merges against the file on disk, not the state captured at plan time', async () => {
    // Merges apply after the package-json, node and dependencies writers. Reusing planned content
    // here would silently revert whatever those just wrote.
    const { targetDir, templateDir } = await makeDirs(
      { name: 'x', version: '1.0.0' },
      { scripts: { lint: 'oxlint' } },
    );
    const changes = await planMerges(targetDir, EXISTING_FILES, RULES, templateDir, VARS);

    // Stand in for an earlier operation writing package.json between plan and apply.
    await writeFile(
      join(targetDir, 'package.json'),
      `${JSON.stringify({ name: 'x', version: '2.0.0' }, null, 2)}\n`,
    );

    await applyMerges(targetDir, changes, templateDir, VARS);

    const after = JSON.parse(await readFile(join(targetDir, 'package.json'), 'utf8')) as {
      version: string;
      scripts: Record<string, string>;
    };
    expect(after.version).toBe('2.0.0');
    expect(after.scripts.lint).toBe('oxlint');

    await cleanup(targetDir, templateDir);
  });

  it('passes the shared diff state through so yes-to-all is honoured', async () => {
    const { targetDir, templateDir } = await makeDirs({ name: 'x' }, { scripts: { lint: 'oxlint' } });
    const diffState = { yesAll: true };

    await applyMerges(
      targetDir,
      [{ file: 'package.json', strategy: 'custom' }],
      templateDir,
      VARS,
      diffState,
    );

    expect(confirmFileWriteMock).toHaveBeenCalledWith(
      join(targetDir, 'package.json'),
      expect.any(String),
      expect.any(String),
      diffState,
    );

    await cleanup(targetDir, templateDir);
  });
});
