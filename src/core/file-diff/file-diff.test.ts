import * as clack from '@clack/prompts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { confirmFileWrite, createDiffConfirmState, renderFileDiff } from './file-diff.utils';

vi.mock('picocolors', () => ({
  default: {
    green: (s: string) => s,
    red: (s: string) => s,
    cyan: (s: string) => s,
    bold: (s: string) => s,
    white: (s: string) => s,
  },
}));

vi.mock('@clack/prompts', () => ({
  log: { message: vi.fn() },
  select: vi.fn(),
  isCancel: vi.fn().mockReturnValue(false),
}));

const logMessage = () => vi.mocked(clack.log.message);
const select = () => vi.mocked(clack.select);
const isCancel = () => vi.mocked(clack.isCancel);

beforeEach(() => {
  vi.clearAllMocks();
  isCancel().mockReturnValue(false);
});

// ─── createDiffConfirmState ───────────────────────────────────────────────────

describe('createDiffConfirmState', () => {
  it('returns { yesAll: false }', () => {
    expect(createDiffConfirmState()).toEqual({ yesAll: false });
  });
});

// ─── renderFileDiff ───────────────────────────────────────────────────────────

describe('renderFileDiff', () => {
  it('passes the file path and diff to clack.log.message', () => {
    renderFileDiff('src/foo.ts', 'old\n', 'new\n');

    expect(logMessage()).toHaveBeenCalledOnce();
    const output = logMessage().mock.calls[0]?.[0] as string;
    expect(output).toContain('src/foo.ts');
    expect(output).toContain('+new');
    expect(output).toContain('-old');
  });

  it('suppresses Index: and === header lines emitted by createPatch', () => {
    renderFileDiff('a.ts', 'x\n', 'y\n');

    const output = logMessage().mock.calls[0]?.[0] as string;
    expect(output).not.toMatch(/^Index:/m);
    expect(output).not.toMatch(/^={3,}/m);
  });

  it('includes @@ hunk header', () => {
    renderFileDiff('a.ts', 'x\n', 'y\n');

    const output = logMessage().mock.calls[0]?.[0] as string;
    expect(output).toContain('@@');
  });

  it('shows all added lines when current is empty (new file)', () => {
    renderFileDiff('new.ts', '', 'line1\nline2\n');

    const output = logMessage().mock.calls[0]?.[0] as string;
    expect(output).toContain('+line1');
    expect(output).toContain('+line2');
  });
});

// ─── confirmFileWrite ─────────────────────────────────────────────────────────

describe('confirmFileWrite', () => {
  it('returns skip immediately when contents are identical', async () => {
    const result = await confirmFileWrite('foo.ts', 'same', 'same');

    expect(result).toBe('skip');
    expect(logMessage()).not.toHaveBeenCalled();
    expect(select()).not.toHaveBeenCalled();
  });

  it('returns write without prompting when state.yesAll is true', async () => {
    const state = { yesAll: true };
    const result = await confirmFileWrite('foo.ts', 'old\n', 'new\n', state);

    expect(result).toBe('write');
    expect(select()).not.toHaveBeenCalled();
  });

  it('still renders the diff when state.yesAll is true', async () => {
    const state = { yesAll: true };
    await confirmFileWrite('foo.ts', 'old\n', 'new\n', state);

    expect(logMessage()).toHaveBeenCalledOnce();
  });

  it('returns write when user selects write', async () => {
    select().mockResolvedValue('write');

    const result = await confirmFileWrite('foo.ts', 'old\n', 'new\n');

    expect(result).toBe('write');
  });

  it('returns skip when user selects skip', async () => {
    select().mockResolvedValue('skip');

    const result = await confirmFileWrite('foo.ts', 'old\n', 'new\n');

    expect(result).toBe('skip');
  });

  it('returns write-all and sets state.yesAll when user selects write-all', async () => {
    select().mockResolvedValue('write-all');
    const state = createDiffConfirmState();

    const result = await confirmFileWrite('foo.ts', 'old\n', 'new\n', state);

    expect(result).toBe('write-all');
    expect(state.yesAll).toBe(true);
  });

  it('does not mutate state when no state is passed and user selects write-all', async () => {
    select().mockResolvedValue('write-all');

    // Should not throw even without a state object
    await expect(confirmFileWrite('foo.ts', 'old\n', 'new\n')).resolves.toBe('write-all');
  });

  it('returns skip on cancel', async () => {
    select().mockResolvedValue('__cancel__');
    isCancel().mockReturnValue(true);

    const result = await confirmFileWrite('foo.ts', 'old\n', 'new\n');

    expect(result).toBe('skip');
  });

  it('yesAll propagates across multiple calls via shared state', async () => {
    select().mockResolvedValue('write-all');
    const state = createDiffConfirmState();

    await confirmFileWrite('a.ts', 'old\n', 'new\n', state);
    expect(state.yesAll).toBe(true);

    // Second call: select should NOT be called again
    select().mockClear();
    const second = await confirmFileWrite('b.ts', 'old\n', 'new2\n', state);
    expect(second).toBe('write');
    expect(select()).not.toHaveBeenCalled();
  });
});
