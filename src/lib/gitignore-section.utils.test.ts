import { describe, expect, it } from 'vitest';

import { findGitignoreCommentSectionRange } from './gitignore-section.utils.js';

describe('gitignore-section.utils', () => {
  it('findGitignoreCommentSectionRange returns slice excluding next section header', () => {
    const lines = ['# Agents', '.agents/', '', '# IDE', '**/.idea'];
    const r = findGitignoreCommentSectionRange(lines, 'Agents');
    expect(r).toEqual({ start: 0, end: 3 });
    expect(lines.slice(r!.start, r!.end).join('\n')).toBe('# Agents\n.agents/\n');
  });

  it('findGitignoreCommentSectionRange returns null when section missing', () => {
    expect(findGitignoreCommentSectionRange(['# IDE'], 'Agents')).toBeNull();
  });
});
