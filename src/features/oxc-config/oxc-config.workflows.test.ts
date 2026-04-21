import { describe, expect, it } from 'vitest';

import { scrubDprintFromWorkflowContent } from './oxc-config.workflows';

describe('oxc-config.workflows — scrubDprintFromWorkflowContent', () => {
  it('replaces pnpm dprint check with pnpm format:check', () => {
    const input = `
      - name: Format check
        run: pnpm dprint check
`;
    const { content, changed } = scrubDprintFromWorkflowContent(input);
    expect(changed).toBe(true);
    expect(content).toContain('run: pnpm format:check');
    expect(content).not.toContain('dprint');
  });

  it('rewrites chained lint && dprint check', () => {
    const input = 'run: pnpm lint && pnpm dprint check\n';
    const { content, changed } = scrubDprintFromWorkflowContent(input);
    expect(changed).toBe(true);
    expect(content).toBe('run: pnpm lint && pnpm format:check\n');
  });

  it('is a no-op when already on format:check', () => {
    const input = `
      - name: Format check
        run: pnpm format:check
`;
    const { content, changed } = scrubDprintFromWorkflowContent(input);
    expect(changed).toBe(false);
    expect(content).toBe(input);
  });
});
