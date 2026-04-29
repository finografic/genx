import { describe, expect, it } from 'vitest';

import {
  CANONICAL_AGENTS_GITIGNORE_LINES,
  proposeAgentsGitignoreMerge,
  rewriteDotAiPathsToAgents,
} from './agents-gitignore.utils.js';

describe('agents-gitignore.utils', () => {
  it('rewriteDotAiPathsToAgents replaces path prefix', () => {
    expect(rewriteDotAiPathsToAgents('See `.ai/handoff.md`')).toBe('See `.agents/handoff.md`');
  });

  it('proposeAgentsGitignoreMerge appends missing canonical lines', () => {
    const before = '# misc\n*.log\n';
    const after = proposeAgentsGitignoreMerge(before);
    expect(after).not.toBe(before);
    const trimmed = after.split('\n').map((l) => l.trim());
    const patterns = CANONICAL_AGENTS_GITIGNORE_LINES.filter((l) => !l.startsWith('#'));
    expect(patterns.every((line) => trimmed.includes(line))).toBe(true);
  });

  it('proposeAgentsGitignoreMerge is a no-op when complete', () => {
    const complete = `${CANONICAL_AGENTS_GITIGNORE_LINES.join('\n')}\n`;
    expect(proposeAgentsGitignoreMerge(complete)).toBe(complete);
  });
});
