import { promptMultiSelect } from '@finografic/cli-kit/flow';
import { describe, expect, it, vi } from 'vitest';
import type { Feature } from 'features/feature.types';

import { sortAuditEntries } from './audit.js';
import { promptAuditSuggest } from './audit.prompt.js';

vi.mock('@finografic/cli-kit/flow', () => ({
  promptMultiSelect: vi.fn(async () => []),
}));

const promptMultiSelectMock = vi.mocked(promptMultiSelect);

function feature(id: Feature['id'], label: string): Feature {
  return {
    id,
    label,
    apply: vi.fn(async () => ({ applied: [] })),
  };
}

describe('audit prompt entries', () => {
  it('sorts partial and missing entries before installed entries', () => {
    const installed = { feature: feature('oxc-config', 'Oxc'), status: 'installed' as const };
    const missing = { feature: feature('markdown', 'Markdown'), status: 'missing' as const };
    const partial = { feature: feature('gitHooks', 'Git hooks'), status: 'partial' as const };

    expect(sortAuditEntries([installed, missing, partial])).toEqual([partial, missing, installed]);
  });

  it('keeps installed features visible but disabled with an ok label', async () => {
    const installed = { feature: feature('oxc-config', 'Oxc'), status: 'installed' as const };

    await promptAuditSuggest({ flags: {}, yesMode: false, args: [] }, [installed]);

    expect(promptMultiSelectMock).toHaveBeenCalledOnce();
    expect(promptMultiSelectMock.mock.calls[0]?.[1]).toMatchObject({
      options: [
        {
          value: 'oxc-config',
          disabled: true,
          label: expect.stringContaining('ok — config up to date'),
        },
      ],
    });
  });
});
