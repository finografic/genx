import { describe, expect, it } from 'vitest';

import {
  extractRulesGeneralSection,
  proposeAgentsWithRulesGeneralBlock,
} from './ai-instructions.agents.utils.js';

describe('ai-instructions AGENTS.md Rules — General', () => {
  const templateBlock = `## Rules — General

Rules are canonical.

- General: \`.github/instructions/00-general.instructions.md\`
`;

  it('extracts the Rules — General block before Markdown Tables', () => {
    const full = `# T

## Rules — General

Intro

- a: b

---

## Rules — Markdown Tables

x
`;
    expect(extractRulesGeneralSection(full)).toBe(`## Rules — General

Intro

- a: b

---`);
  });

  it('replaces an outdated Rules — General block', () => {
    const current = `## Skills

## Rules — General

Old list

---

## Rules — Markdown Tables

t
`;
    const next = proposeAgentsWithRulesGeneralBlock(current, templateBlock);
    expect(next).not.toBeNull();
    expect(next).toContain('Rules are canonical');
    expect(next).toContain('## Rules — Markdown Tables');
  });

  it('returns null when the block already matches', () => {
    const current = `${templateBlock}

## Rules — Markdown Tables

x
`;
    expect(proposeAgentsWithRulesGeneralBlock(current, templateBlock)).toBeNull();
  });
});
