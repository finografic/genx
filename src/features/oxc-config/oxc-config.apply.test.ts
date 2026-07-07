import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PACKAGE_JSON } from 'config/constants.config';

import { applyPreviewChanges } from '../../lib/feature-preview/index.js';
import { applyOxcConfig } from './oxc-config.apply.js';
import { previewOxcConfig } from './oxc-config.preview.js';

const mocks = vi.hoisted(() => ({
  runPnpmInstall: vi.fn(),
}));

vi.mock('./oxc-config.preview.js', () => ({
  previewOxcConfig: vi.fn(),
}));

vi.mock('../../lib/feature-preview/index.js', () => ({
  applyPreviewChanges: vi.fn(),
}));

vi.mock('utils', () => ({
  errorMessage: vi.fn(),
  runPnpmInstall: mocks.runPnpmInstall,
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
}));

const previewOxcConfigMock = vi.mocked(previewOxcConfig);
const applyPreviewChangesMock = vi.mocked(applyPreviewChanges);

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
    previewOxcConfigMock.mockResolvedValue(preview);
    applyPreviewChangesMock.mockResolvedValue({ applied: [], noopMessage: 'ok' });

    await applyOxcConfig({ targetDir: '/tmp/x' });

    expect(previewOxcConfigMock).toHaveBeenCalledTimes(1);
    expect(previewOxcConfigMock).toHaveBeenCalledWith({ targetDir: '/tmp/x' });
    expect(applyPreviewChangesMock).toHaveBeenCalledTimes(1);
    expect(applyPreviewChangesMock).toHaveBeenCalledWith(preview, { yesAll: undefined });
  });

  it('returns noop when preview apply reports nothing written', async () => {
    previewOxcConfigMock.mockResolvedValue({
      changes: [],
      applied: [],
      noopMessage: 'already ok',
    });
    applyPreviewChangesMock.mockResolvedValue({ applied: [], noopMessage: 'already ok' });

    const result = await applyOxcConfig({ targetDir: '/tmp/x' });
    expect(result).toEqual({ applied: [], noopMessage: 'already ok' });
    expect(mocks.runPnpmInstall).not.toHaveBeenCalled();
  });

  it('returns noop when all preview writes were skipped', async () => {
    previewOxcConfigMock.mockResolvedValue({
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

    const result = await applyOxcConfig({ targetDir: '/tmp/x' });
    expect(result.noopMessage).toBe('All changes were skipped.');
    expect(mocks.runPnpmInstall).not.toHaveBeenCalled();
  });

  it('runs pnpm install when needsInstall and appliedTargetPaths includes package.json (labels ignored)', async () => {
    const targetDir = '/tmp/target';
    const packageJsonPath = resolve(targetDir, PACKAGE_JSON);
    const preview = {
      changes: [],
      applied: [],
      needsInstall: true as const,
    };
    previewOxcConfigMock.mockResolvedValue(preview);
    applyPreviewChangesMock.mockResolvedValue({
      applied: ['label with no manifest substring'],
      appliedTargetPaths: [packageJsonPath],
    });
    mocks.runPnpmInstall.mockResolvedValue(undefined);

    const result = await applyOxcConfig({ targetDir });

    expect(applyPreviewChangesMock).toHaveBeenCalledWith(preview, { yesAll: undefined });
    expect(mocks.runPnpmInstall).toHaveBeenCalledWith(targetDir);
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
    previewOxcConfigMock.mockResolvedValue(preview);
    applyPreviewChangesMock.mockResolvedValue({
      applied: ['oxlint.config.ts'],
      appliedTargetPaths: [resolve(targetDir, 'oxlint.config.ts')],
    });

    const result = await applyOxcConfig({ targetDir });
    expect(mocks.runPnpmInstall).not.toHaveBeenCalled();
    expect(result.applied).toEqual(['oxlint.config.ts']);
  });

  it('does not run pnpm install when package.json was written but preview says dependencies did not change', async () => {
    const targetDir = '/tmp/target';
    const packageJsonPath = resolve(targetDir, PACKAGE_JSON);
    const preview = {
      changes: [],
      applied: [],
    };
    previewOxcConfigMock.mockResolvedValue(preview);
    applyPreviewChangesMock.mockResolvedValue({
      applied: ['package.json (scripts only)'],
      appliedTargetPaths: [packageJsonPath],
    });

    const result = await applyOxcConfig({ targetDir });
    expect(mocks.runPnpmInstall).not.toHaveBeenCalled();
    expect(result.applied).toEqual(['package.json (scripts only)']);
  });
});
