import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { confirmFileWrite, createDiffConfirmState } from '../../core/file-diff/file-diff.utils.js';
import {
  applyPreviewChanges,
  createDeletePreviewChange,
  createWritePreviewChange,
  getChangedPreviewChanges,
  hasPreviewChanges,
  isPreviewChangeChanged,
} from './feature-preview.utils.js';

vi.mock('../../core/file-diff/file-diff.utils.js', () => ({
  confirmFileWrite: vi.fn(),
  createDiffConfirmState: vi.fn(() => ({ yesAll: false })),
}));

const confirmFileWriteMock = vi.mocked(confirmFileWrite);
const createDiffConfirmStateMock = vi.mocked(createDiffConfirmState);

beforeEach(() => {
  vi.clearAllMocks();
  createDiffConfirmStateMock.mockReturnValue({ yesAll: false });
});

describe('feature-preview — isPreviewChangeChanged', () => {
  it('treats identical write snapshots as unchanged', () => {
    const change = createWritePreviewChange('a.ts', 'same', 'same');
    expect(isPreviewChangeChanged(change)).toBe(false);
  });

  it('detects changed write snapshots', () => {
    const change = createWritePreviewChange('a.ts', 'old', 'new');
    expect(isPreviewChangeChanged(change)).toBe(true);
  });

  it('treats delete as unchanged when the path did not exist', () => {
    const change = createDeletePreviewChange('gone.ts', '', false);
    expect(isPreviewChangeChanged(change)).toBe(false);
  });

  it('detects delete when the path existed', () => {
    const change = createDeletePreviewChange('x.ts', 'body', true);
    expect(isPreviewChangeChanged(change)).toBe(true);
  });
});

describe('feature-preview — getChangedPreviewChanges', () => {
  it('filters to changed entries only', () => {
    const changes = [
      createWritePreviewChange('a.ts', '1', '1'),
      createWritePreviewChange('b.ts', '1', '2'),
      createDeletePreviewChange('c.ts', '', false),
    ];
    expect(getChangedPreviewChanges(changes)).toEqual([changes[1]]);
  });
});

describe('feature-preview — hasPreviewChanges', () => {
  it('returns false when no changed entries exist', () => {
    expect(
      hasPreviewChanges([
        createWritePreviewChange('a.ts', 'x', 'x'),
        createDeletePreviewChange('b.ts', '', false),
      ]),
    ).toBe(false);
  });

  it('returns true when a write change differs', () => {
    expect(hasPreviewChanges([createWritePreviewChange('a.ts', 'a', 'b')])).toBe(true);
  });

  it('accepts a FeaturePreviewResult wrapper', () => {
    expect(
      hasPreviewChanges({
        changes: [createWritePreviewChange('a.ts', 'a', 'b')],
        applied: [],
      }),
    ).toBe(true);
  });
});

describe('feature-preview — applyPreviewChanges', () => {
  it('returns noop when no changed entries exist', async () => {
    const result = await applyPreviewChanges({
      changes: [createWritePreviewChange('a.ts', 'same', 'same')],
      applied: [],
      noopMessage: 'Custom noop',
    });

    expect(result).toEqual({ applied: [], noopMessage: 'Custom noop' });
    expect(confirmFileWriteMock).not.toHaveBeenCalled();
  });

  it('returns default noop when nothing changed and no custom noopMessage', async () => {
    const result = await applyPreviewChanges({
      changes: [createWritePreviewChange('a.ts', 'same', 'same')],
      applied: [],
    });

    expect(result.noopMessage).toBe('No changes to apply.');
  });

  it('writes an approved file and records the path', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-fp-'));
    const filePath = join(root, 'out.txt');
    confirmFileWriteMock.mockResolvedValue('write');

    const result = await applyPreviewChanges({
      changes: [createWritePreviewChange(filePath, '', 'hello')],
      applied: [],
    });

    expect(result.applied).toEqual([filePath]);
    expect(await readFile(filePath, 'utf8')).toBe('hello');
    expect(confirmFileWriteMock).toHaveBeenCalledOnce();

    await rm(root, { recursive: true, force: true });
  });

  it('skips a file without mutating disk when confirmation returns skip', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-fp-'));
    const filePath = join(root, 'keep.txt');
    await writeFile(filePath, 'old', 'utf8');
    confirmFileWriteMock.mockResolvedValue('skip');

    const result = await applyPreviewChanges({
      changes: [createWritePreviewChange(filePath, 'old', 'new')],
      applied: [],
    });

    expect(result).toEqual({ applied: [], noopMessage: 'All changes were skipped.' });
    expect(await readFile(filePath, 'utf8')).toBe('old');

    await rm(root, { recursive: true, force: true });
  });

  it('deletes an approved file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-fp-'));
    const filePath = join(root, 'remove.txt');
    await writeFile(filePath, 'bye', 'utf8');
    confirmFileWriteMock.mockResolvedValue('write');

    const result = await applyPreviewChanges({
      changes: [createDeletePreviewChange(filePath, 'bye', true)],
      applied: [],
    });

    expect(result.applied).toEqual([filePath]);
    await expect(readFile(filePath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });

    await rm(root, { recursive: true, force: true });
  });

  it('honours write-all from confirmFileWrite', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-fp-'));
    const a = join(root, 'a.txt');
    const b = join(root, 'b.txt');
    await writeFile(a, 'a0', 'utf8');
    await writeFile(b, 'b0', 'utf8');
    confirmFileWriteMock.mockResolvedValueOnce('write-all').mockResolvedValue('write');

    const result = await applyPreviewChanges({
      changes: [createWritePreviewChange(a, 'a0', 'a1'), createWritePreviewChange(b, 'b0', 'b1')],
      applied: [],
    });

    expect(result.applied).toEqual([a, b]);
    expect(await readFile(a, 'utf8')).toBe('a1');
    expect(await readFile(b, 'utf8')).toBe('b1');

    await rm(root, { recursive: true, force: true });
  });
});
