import { execa } from 'execa';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

  it('runs pnpm install when manifest dependency changes were applied to package.json', async () => {
    previewOxfmtMock.mockResolvedValue({
      changes: [],
      applied: [],
      needsInstall: true,
    });
    applyPreviewChangesMock.mockResolvedValue({
      applied: ['package.json (oxfmt, Prettier/dprint cleanup, scripts, lint-staged)'],
    });
    execaMock.mockResolvedValue({} as never);

    const result = await applyOxfmt({ targetDir: '/tmp/target' });
    expect(execaMock).toHaveBeenCalledWith('pnpm', ['install'], { cwd: '/tmp/target' });
    expect(result.applied).toEqual([
      'package.json (oxfmt, Prettier/dprint cleanup, scripts, lint-staged)',
      'dependencies (pnpm install)',
    ]);
  });

  it('does not run pnpm install when needsInstall is set but package.json was skipped', async () => {
    previewOxfmtMock.mockResolvedValue({
      changes: [],
      applied: [],
      needsInstall: true,
    });
    applyPreviewChangesMock.mockResolvedValue({
      applied: ['eslint.config.ts (oxfmt-covered ESLint cleanup)'],
    });

    const result = await applyOxfmt({ targetDir: '/tmp/target' });
    expect(execaMock).not.toHaveBeenCalled();
    expect(result.applied).toEqual(['eslint.config.ts (oxfmt-covered ESLint cleanup)']);
  });
});
