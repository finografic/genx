import { describe, expect, it } from 'vitest';

import { addGitignorePattern } from './render-gitignore.utils.js';

describe('addGitignorePattern', () => {
  it('appends a new Design section when none exists', () => {
    expect(addGitignorePattern('node_modules\ndist\n', 'DESIGN.html')).toBe(
      'node_modules\ndist\n\n# Design\nDESIGN.html\n',
    );
  });

  it('extends an existing Design section rather than adding a second', () => {
    const current = '# Design\nfoo.html\n\n# Build\ndist\n';
    expect(addGitignorePattern(current, 'DESIGN.html')).toBe(
      '# Design\nfoo.html\nDESIGN.html\n\n# Build\ndist\n',
    );
  });

  it('returns null when the pattern is already listed', () => {
    expect(addGitignorePattern('dist\nDESIGN.html\n', 'DESIGN.html')).toBeNull();
    // Position and section do not matter — only that git already covers it.
    expect(addGitignorePattern('# Design\n  DESIGN.html  \n', 'DESIGN.html')).toBeNull();
  });

  it('handles an empty gitignore without a leading blank line', () => {
    expect(addGitignorePattern('', 'DESIGN.html')).toBe('# Design\nDESIGN.html\n');
  });
});
