import { describe, expect, it } from 'vitest';

import {
  getCanonicalAgentsGitignoreLines,
  proposeAgentsGitignoreMerge,
  rewriteDotAiPathsToAgents,
} from './agents-gitignore.utils.js';

describe('agents-gitignore.utils', () => {
  it('rewriteDotAiPathsToAgents replaces path prefix', () => {
    expect(rewriteDotAiPathsToAgents('See `.ai/handoff.md`')).toBe('See `.agents/handoff.md`');
  });

  it('proposeAgentsGitignoreMerge inserts canonical # Agents block after # Environment files when missing', () => {
    const before = `# Environment files
.env

# IDE
.idea/
`;
    const after = proposeAgentsGitignoreMerge(before);
    expect(after).not.toBe(before);
    expect(after.includes('# Agents')).toBe(true);
    const trimmed = after.split('\n').map((l) => l.trim());
    const patterns = getCanonicalAgentsGitignoreLines().filter((l) => !l.startsWith('#'));
    expect(patterns.every((line) => trimmed.includes(line))).toBe(true);
    expect(after.indexOf('# Environment files')).toBeLessThan(after.indexOf('# Agents'));
    expect(after.indexOf('# Agents')).toBeLessThan(after.indexOf('# IDE'));
  });

  it('proposeAgentsGitignoreMerge replaces an existing # Agents section in place', () => {
    const canonical = getCanonicalAgentsGitignoreLines().join('\n');
    const junkAgents = `# Agents
.old-pattern/
`;
    const before = `# Environment files
.env

${junkAgents}
# IDE
.idea/
`;
    const after = proposeAgentsGitignoreMerge(before);
    expect(after).not.toContain('.old-pattern/');
    expect(after).toContain(canonical.split('\n')[1] ?? '');
  });

  it('proposeAgentsGitignoreMerge is idempotent once canonical', () => {
    const complete = `${getCanonicalAgentsGitignoreLines().join('\n')}\n`;
    const once = proposeAgentsGitignoreMerge(complete);
    expect(proposeAgentsGitignoreMerge(once)).toBe(once);
  });
});
