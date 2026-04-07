import { resolve } from 'node:path';
import { execa } from 'execa';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PACKAGE_JSON } from 'config/constants.config';
import { applyPreviewChanges } from '../../lib/feature-preview/index.js';
import { applyOxfmt } from './oxfmt.apply.js';
import { previewOxfmt } from './oxfmt.preview.js';

vi.mock('./oxfmt.preview.js', () => ({
  previewOxfmt: vi.fn(),
}));

vi.mock('../../lib/feature-preview/index.js', () => ({
  applyPreviewChanges: vi.fn(),
}));

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

vi.mock('utils', () => ({
  errorMessage: vi.fn(),
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
}));

const previewOxfmtMock = vi.mocked(previewOxfmt);
const applyPreviewChangesMock = vi.mocked(applyPreviewChanges);
const execaMock = vi.mocked(execa);

describe('oxfmt.apply — preview-driven apply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls previewOxfmt then applyPreviewChanges with that preview', async () => {
    const preview = {
      changes: [],
      applied: [],
      noopMessage: 'ok',
    };
    previewOxfmtMock.mockResolvedValue(preview);
    applyPreviewChangesMock.mockResolvedValue({ applied: [], noopMessage: 'ok' });

    await applyOxfmt({ targetDir: '/tmp/x' });

    expect(previewOxfmtMock).toHaveBeenCalledTimes(1);
    expect(previewOxfmtMock).toHaveBeenCalledWith({ targetDir: '/tmp/x' });
    expect(applyPreviewChangesMock).toHaveBeenCalledTimes(1);
    expect(applyPreviewChangesMock).toHaveBeenCalledWith(preview);
  });

  it('returns noop when preview apply reports nothing written', async () => {
    previewOxfmtMock.mockResolvedValue({
      changes: [],
      applied: [],
      noopMessage: 'already ok',
    });
    applyPreviewChangesMock.mockResolvedValue({ applied: [], noopMessage: 'already ok' });

    const result = await applyOxfmt({ targetDir: '/tmp/x' });
    expect(result).toEqual({ applied: [], noopMessage: 'already ok' });
    expect(execaMock).not.toHaveBeenCalled();
  });

  it('returns noop when all preview writes were skipped', async () => {
    previewOxfmtMock.mockResolvedValue({
      changes: [
        {
          kind: 'write',
          path: '/tmp/x/package.json',
          currentContent: '{}',
          proposedContent: '{"x":1}',
        },
      ],
      applied: [],
    });
    applyPreviewChangesMock.mockResolvedValue({
      applied: [],
      noopMessage: 'All changes were skipped.',
    });

    const result = await applyOxfmt({ targetDir: '/tmp/x' });
    expect(result.noopMessage).toBe('All changes were skipped.');
    expect(execaMock).not.toHaveBeenCalled();
  });

  it('runs pnpm install when needsInstall and appliedTargetPaths includes package.json (labels ignored)', async () => {
    const targetDir = '/tmp/target';
    const packageJsonPath = resolve(targetDir, PACKAGE_JSON);
    const preview = {
      changes: [],
      applied: [],
      needsInstall: true as const,
    };
    previewOxfmtMock.mockResolvedValue(preview);
    applyPreviewChangesMock.mockResolvedValue({
      applied: ['label with no manifest substring'],
      appliedTargetPaths: [packageJsonPath],
    });
    execaMock.mockResolvedValue({} as never);

    const result = await applyOxfmt({ targetDir });

    expect(applyPreviewChangesMock).toHaveBeenCalledWith(preview);
    expect(execaMock).toHaveBeenCalledWith('pnpm', ['install'], { cwd: targetDir });
    expect(result.applied).toEqual(['label with no manifest substring', 'dependencies (pnpm install)']);
    expect(result.appliedTargetPaths).toEqual([packageJsonPath]);
  });

  it('does not run pnpm install when needsInstall but package.json was not in appliedTargetPaths', async () => {
    const targetDir = '/tmp/target';
    const preview = {
      changes: [],
      applied: [],
      needsInstall: true as const,
    };
    previewOxfmtMock.mockResolvedValue(preview);
    applyPreviewChangesMock.mockResolvedValue({
      applied: ['eslint.config.ts (oxfmt-covered ESLint cleanup)'],
      appliedTargetPaths: [resolve(targetDir, 'eslint.config.ts')],
    });

    const result = await applyOxfmt({ targetDir });
    expect(execaMock).not.toHaveBeenCalled();
    expect(result.applied).toEqual(['eslint.config.ts (oxfmt-covered ESLint cleanup)']);
  });
});
