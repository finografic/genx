import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { resolveTemplateSourcePath, TEMPLATE_DOT_TEMPLATE_BY_OUTPUT } from './template-source.utils.js';

describe('resolveTemplateSourcePath', () => {
  const dir = '/repo/_templates';

  it('maps AGENTS.md and CLAUDE.md to *.template sources', () => {
    expect(TEMPLATE_DOT_TEMPLATE_BY_OUTPUT['AGENTS.md']).toBe('AGENTS.md.template');
    expect(TEMPLATE_DOT_TEMPLATE_BY_OUTPUT['CLAUDE.md']).toBe('CLAUDE.md.template');
    expect(resolveTemplateSourcePath(dir, 'AGENTS.md')).toBe(resolve(dir, 'AGENTS.md.template'));
    expect(resolveTemplateSourcePath(dir, 'CLAUDE.md')).toBe(resolve(dir, 'CLAUDE.md.template'));
  });

  it('leaves other template paths unchanged', () => {
    expect(resolveTemplateSourcePath(dir, '.claude/memory.md')).toBe(resolve(dir, '.claude/memory.md'));
  });
});
