import { describe, expect, it } from 'vitest';

import { appendMigratedClaudeHandoff, stripLeadingMarkdownH1 } from './ai-claude.handoff.utils.js';

describe('stripLeadingMarkdownH1', () => {
  it('removes first H1 and following blank lines', () => {
    const input = '# Old title\n\nBody line\n';
    expect(stripLeadingMarkdownH1(input)).toBe('Body line\n');
  });

  it('returns unchanged when no H1', () => {
    expect(stripLeadingMarkdownH1('No heading\n')).toBe('No heading\n');
  });
});

describe('appendMigratedClaudeHandoff', () => {
  it('appends migrated section when legacy body is non-empty', () => {
    const templated = '# Pkg — Handoff\n\n## Project\n\nok\n';
    const legacy = '# Claude only\n\nLegacy note\n';
    const out = appendMigratedClaudeHandoff(templated, legacy);
    expect(out).toContain('# Pkg — Handoff');
    expect(out).toContain('## Imported from `.claude/handoff.md`');
    expect(out).toContain('Legacy note');
    expect(out).not.toContain('# Claude only');
  });

  it('returns templated body only when legacy is empty after strip', () => {
    const templated = '# X\n';
    expect(appendMigratedClaudeHandoff(templated, '# Title\n')).toBe('# X\n');
  });
});
