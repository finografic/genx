import { describe, expect, it } from 'vitest';

import {
  getCanonicalAgentsGitignoreLines,
  getCanonicalGitignoreBody,
  proposeAgentsGitignoreMerge,
  proposeGitignoreMerge,
  rewriteDotAiPathsToAgents,
} from './agents-gitignore.utils.js';

describe('agents-gitignore.utils', () => {
  it('rewriteDotAiPathsToAgents replaces path prefix', () => {
    expect(rewriteDotAiPathsToAgents('See `.ai/handoff.md`')).toBe('See `.agents/handoff.md`');
  });

  it('proposeGitignoreMerge replaces outdated sections with canonical content', () => {
    const before = `# Environment files
.env

# Agents
.old-pattern/

# IDE
.idea/
`;
    const after = proposeGitignoreMerge(before);
    expect(after).not.toBe(before);
    expect(after).toContain('# Agents');
    expect(after).not.toContain('.old-pattern/');
    expect(after.startsWith(getCanonicalGitignoreBody())).toBe(true);
    const patterns = getCanonicalAgentsGitignoreLines().filter((l) => !l.startsWith('#'));
    expect(patterns.every((line) => after.includes(line))).toBe(true);
  });

  it('proposeGitignoreMerge preserves project-specific extras at the bottom', () => {
    const before = `${getCanonicalGitignoreBody()}
# Project-specific
my-local-artifacts/
`;
    const after = proposeGitignoreMerge(before);
    expect(after.endsWith('my-local-artifacts/\n')).toBe(true);
    expect(after.includes('# Project-specific')).toBe(true);
  });

  it('proposeGitignoreMerge appends unknown sections as project-specific extras', () => {
    const before = `# Environment files
.env

# Custom tooling
vendor-cache/
`;
    const after = proposeGitignoreMerge(before);
    expect(after).toContain('# Project-specific');
    expect(after).toContain('# Custom tooling');
    expect(after).toContain('vendor-cache/');
    expect(after.indexOf('# Project-specific')).toBeLessThan(after.indexOf('# Custom tooling'));
  });

  it('proposeGitignoreMerge omits duplicate patterns already in canonical', () => {
    const before = `${getCanonicalGitignoreBody()}
# Project-specific
coverage/
`;
    const after = proposeGitignoreMerge(before);
    expect(after).not.toContain('# Project-specific');
  });

  it('proposeGitignoreMerge treats legacy section title aliases as canonical', () => {
    const before = `${getCanonicalGitignoreBody()}

# OS
.DS_Store
Thumbs.db
ehthumbs.db
Desktop.ini
*~
`;
    const after = proposeGitignoreMerge(before);
    expect(after).toContain('# OS files');
    expect(after).not.toContain('# Project-specific');
    expect(after).not.toContain('# OS\n');
  });

  it('proposeGitignoreMerge is idempotent once canonical', () => {
    const complete = `${getCanonicalGitignoreBody()}\n`;
    const once = proposeGitignoreMerge(complete);
    expect(proposeGitignoreMerge(once)).toBe(once);
  });

  it('proposeAgentsGitignoreMerge delegates to proposeGitignoreMerge', () => {
    const before = '# Agents\n.old/\n';
    expect(proposeAgentsGitignoreMerge(before)).toBe(proposeGitignoreMerge(before));
  });
});
