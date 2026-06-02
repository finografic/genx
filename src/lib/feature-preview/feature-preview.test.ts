import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDiffConfirmState, renderFileDiff } from '@finografic/cli-kit/file-diff';
import * as clack from '@clack/prompts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockedFunction } from 'vitest';

import {
  applyPreviewChanges,
  createDeletePreviewChange,
  FeaturePreviewCancelledError,
  createWritePreviewChange,
  getChangedPreviewChanges,
  hasPreviewChanges,
  isPreviewChangeChanged,
} from './feature-preview.utils.js';

vi.mock('@finografic/cli-kit/file-diff', () => ({
  createDiffConfirmState: vi.fn(() => ({ yesAll: false })),
  renderFileDiff: vi.fn(),
}));

vi.mock('@clack/prompts', () => ({
  log: { message: vi.fn() },
  select: vi.fn(),
  cancel: vi.fn(),
  isCancel: vi.fn(() => false),
}));

const createDiffConfirmStateMock = vi.mocked(createDiffConfirmState);
const renderFileDiffMock = vi.mocked(renderFileDiff);
const logMessage = (): MockedFunction<typeof clack.log.message> => vi.mocked(clack.log.message);
const selectMock = (): MockedFunction<typeof clack.select> => vi.mocked(clack.select);
const isCancelMock = (): MockedFunction<typeof clack.isCancel> => vi.mocked(clack.isCancel);

beforeEach(() => {
  vi.clearAllMocks();
  createDiffConfirmStateMock.mockReturnValue({ yesAll: false });
  isCancelMock().mockReturnValue(false);
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

  it('treats equivalent JSON with different formatting as unchanged for .json paths', () => {
    const before = `{\n  "markdown.styles": ["node_modules/@finografic/md-lint/styles/markdown-github-light.css"]\n}\n`;
    const after = `{\n  "markdown.styles": [\n    "node_modules/@finografic/md-lint/styles/markdown-github-light.css"\n  ]\n}\n`;
    const change = createWritePreviewChange('.vscode/settings.json', before, after);
    expect(isPreviewChangeChanged(change)).toBe(false);
  });

  it('still detects JSON semantic changes for .json paths', () => {
    const change = createWritePreviewChange('pkg.json', '{"a":1}', '{"a":2}');
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
    expect(renderFileDiffMock).not.toHaveBeenCalled();
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
    selectMock().mockResolvedValue('write');

    const result = await applyPreviewChanges({
      changes: [createWritePreviewChange(filePath, '', 'hello')],
      applied: [],
    });

    expect(result.applied).toEqual([filePath]);
    expect(result.appliedTargetPaths).toEqual([filePath]);
    expect(await readFile(filePath, 'utf8')).toBe('hello');
    expect(renderFileDiffMock).toHaveBeenCalledWith(filePath, '', 'hello');
    expect(selectMock()).toHaveBeenCalledOnce();
    expect(selectMock().mock.calls[0]?.[0]).toMatchObject({
      message: expect.stringContaining(`Create new file ${filePath}`),
      options: expect.arrayContaining([
        expect.objectContaining({ value: 'write', label: 'Yes, create this file' }),
      ]),
    });

    await rm(root, { recursive: true, force: true });
  });

  it('uses summary in applied when provided for writes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-fp-'));
    const filePath = join(root, 'out.txt');
    selectMock().mockResolvedValue('write');

    const result = await applyPreviewChanges({
      changes: [createWritePreviewChange(filePath, '', 'hello', 'add out.txt')],
      applied: [],
    });

    expect(result.applied).toEqual(['add out.txt']);
    expect(result.appliedTargetPaths).toEqual([filePath]);
    expect(await readFile(filePath, 'utf8')).toBe('hello');

    await rm(root, { recursive: true, force: true });
  });

  it('uses alter wording for existing file writes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-fp-'));
    const filePath = join(root, 'existing.txt');
    await writeFile(filePath, 'old', 'utf8');
    selectMock().mockResolvedValue('write');

    await applyPreviewChanges({
      changes: [createWritePreviewChange(filePath, 'old', 'new')],
      applied: [],
    });

    expect(selectMock().mock.calls[0]?.[0]).toMatchObject({
      message: expect.stringContaining(`Apply changes to ${filePath}`),
      options: expect.arrayContaining([
        expect.objectContaining({ value: 'write', label: 'Yes, alter this file' }),
      ]),
    });

    await rm(root, { recursive: true, force: true });
  });

  it('skips a file without mutating disk when confirmation returns skip', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-fp-'));
    const filePath = join(root, 'keep.txt');
    await writeFile(filePath, 'old', 'utf8');
    selectMock().mockResolvedValue('skip');

    const result = await applyPreviewChanges({
      changes: [createWritePreviewChange(filePath, 'old', 'new')],
      applied: [],
    });

    expect(result).toEqual({ applied: [], noopMessage: 'All changes were skipped.' });
    expect(await readFile(filePath, 'utf8')).toBe('old');

    await rm(root, { recursive: true, force: true });
  });

  it('aborts the entire apply run when a write confirmation is cancelled', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-fp-'));
    const filePath = join(root, 'keep.txt');
    await writeFile(filePath, 'old', 'utf8');
    selectMock().mockResolvedValueOnce('skip');
    isCancelMock().mockReturnValueOnce(true);

    await expect(
      applyPreviewChanges({
        changes: [createWritePreviewChange(filePath, 'old', 'new')],
        applied: [],
      }),
    ).rejects.toBeInstanceOf(FeaturePreviewCancelledError);

    expect(await readFile(filePath, 'utf8')).toBe('old');

    await rm(root, { recursive: true, force: true });
  });

  it('deletes an approved file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-fp-'));
    const filePath = join(root, 'remove.txt');
    await writeFile(filePath, 'bye', 'utf8');
    selectMock().mockResolvedValue('write');

    const result = await applyPreviewChanges({
      changes: [createDeletePreviewChange(filePath, 'bye', true)],
      applied: [],
    });

    expect(result.applied).toEqual([filePath]);
    expect(result.appliedTargetPaths).toEqual([filePath]);
    expect(renderFileDiffMock).toHaveBeenCalledWith(filePath, 'bye', '');
    expect(selectMock()).toHaveBeenCalledOnce();
    expect(selectMock().mock.calls[0]?.[0]).toMatchObject({
      message: expect.stringContaining(`Delete file ${filePath}`),
      options: expect.arrayContaining([
        expect.objectContaining({ value: 'write', label: 'Yes, delete this file' }),
      ]),
    });
    await expect(readFile(filePath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });

    await rm(root, { recursive: true, force: true });
  });

  it('confirms and deletes an existing empty file with a clear deletion preview', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-fp-'));
    const filePath = join(root, 'empty.txt');
    await writeFile(filePath, '', 'utf8');
    selectMock().mockResolvedValue('write');

    const result = await applyPreviewChanges({
      changes: [createDeletePreviewChange(filePath, '', true, 'remove empty config')],
      applied: [],
    });

    expect(logMessage()).toHaveBeenCalled();
    const previewText = logMessage().mock.calls[0]?.[0] as string;
    expect(previewText).toContain('empty.txt');
    expect(previewText).toMatch(/empty file/i);
    expect(previewText).toMatch(/deleted/i);
    expect(selectMock()).toHaveBeenCalledOnce();
    expect(selectMock().mock.calls[0]?.[0]).toMatchObject({
      message: expect.stringContaining(`Delete file ${filePath}`),
      options: expect.arrayContaining([
        expect.objectContaining({ value: 'write', label: 'Yes, delete this file' }),
      ]),
    });
    expect(result.applied).toEqual(['remove empty config']);
    expect(result.appliedTargetPaths).toEqual([filePath]);
    await expect(readFile(filePath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });

    await rm(root, { recursive: true, force: true });
  });

  it('empty-file delete skips the prompt when yesAll is already set', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-fp-'));
    const filePath = join(root, 'empty.txt');
    await writeFile(filePath, '', 'utf8');
    createDiffConfirmStateMock.mockReturnValue({ yesAll: true });

    const result = await applyPreviewChanges({
      changes: [createDeletePreviewChange(filePath, '', true)],
      applied: [],
    });

    expect(selectMock()).not.toHaveBeenCalled();
    expect(logMessage()).toHaveBeenCalledOnce();
    expect(result.applied).toEqual([filePath]);
    expect(result.appliedTargetPaths).toEqual([filePath]);
    await expect(readFile(filePath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });

    await rm(root, { recursive: true, force: true });
  });

  it('uses summary in applied when provided for deletes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-fp-'));
    const filePath = join(root, 'prettier.config.js');
    await writeFile(filePath, 'module.exports = {}', 'utf8');
    selectMock().mockResolvedValue('write');

    const result = await applyPreviewChanges({
      changes: [createDeletePreviewChange(filePath, 'module.exports = {}', true, 'remove prettier config')],
      applied: [],
    });

    expect(result.applied).toEqual(['remove prettier config']);
    expect(result.appliedTargetPaths).toEqual([filePath]);
    expect(renderFileDiffMock).toHaveBeenCalledWith(filePath, 'module.exports = {}', '');
    await expect(readFile(filePath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });

    await rm(root, { recursive: true, force: true });
  });

  it('aborts the entire apply run when a delete confirmation is cancelled', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-fp-'));
    const filePath = join(root, 'remove.txt');
    await writeFile(filePath, 'bye', 'utf8');
    selectMock().mockResolvedValueOnce('skip');
    isCancelMock().mockReturnValueOnce(true);

    await expect(
      applyPreviewChanges({
        changes: [createDeletePreviewChange(filePath, 'bye', true)],
        applied: [],
      }),
    ).rejects.toBeInstanceOf(FeaturePreviewCancelledError);

    expect(await readFile(filePath, 'utf8')).toBe('bye');

    await rm(root, { recursive: true, force: true });
  });

  it('honours write-all from the shared apply prompt', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-fp-'));
    const a = join(root, 'a.txt');
    const b = join(root, 'b.txt');
    await writeFile(a, 'a0', 'utf8');
    await writeFile(b, 'b0', 'utf8');
    selectMock().mockResolvedValueOnce('write-all');

    const result = await applyPreviewChanges({
      changes: [createWritePreviewChange(a, 'a0', 'a1'), createWritePreviewChange(b, 'b0', 'b1')],
      applied: [],
    });

    expect(result.applied).toEqual([a, b]);
    expect(result.appliedTargetPaths).toEqual([a, b]);
    expect(await readFile(a, 'utf8')).toBe('a1');
    expect(await readFile(b, 'utf8')).toBe('b1');
    expect(selectMock()).toHaveBeenCalledOnce();

    await rm(root, { recursive: true, force: true });
  });
});
