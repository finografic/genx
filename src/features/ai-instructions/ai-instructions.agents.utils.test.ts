import { describe, expect, it } from 'vitest';

import {
  extractRulesGeneralSection,
  mergeAgentsFromTemplate,
  normalizeHeadingKey,
} from './ai-instructions.agents.utils.js';

describe('normalizeHeadingKey', () => {
  it('treats em dash and hyphen headings as the same key', () => {
    expect(normalizeHeadingKey('## Rules — Global')).toBe(normalizeHeadingKey('## Rules - General'));
  });
});

describe('mergeAgentsFromTemplate (reverse apply: template base + target extras)', () => {
  const template = `# AGENTS

## Rules — Project-Specific

TEMPLATE_PS

## Rules — Global

TEMPLATE_GENERAL

---

## Rules — Markdown Tables

TEMPLATE_MD

---

## Git Policy

TEMPLATE_GIT

---
`;

  it('uses template bodies for General / Markdown Tables / Git Policy and target for Project-Specific and extras', () => {
    const target = `# Title

## Skills — Extra

KEEP_SKILLS

## Rules — Project-Specific

LONG_PS_FROM_REPO

## Rules — Global

OLD_GENERAL

---

## Rules — Markdown Tables

OLD_MD

---

## Git Policy

OLD_GIT

---
`;

    const next = mergeAgentsFromTemplate(target, template);
    expect(next).not.toBeNull();
    expect(next).toContain('KEEP_SKILLS');
    expect(next).toContain('LONG_PS_FROM_REPO');
    expect(next).toContain('TEMPLATE_GENERAL');
    expect(next).toContain('TEMPLATE_MD');
    expect(next).toContain('TEMPLATE_GIT');
    expect(next).not.toContain('OLD_GENERAL');
    expect(next?.startsWith('# AGENTS')).toBe(true);

    const idxPs = next!.indexOf('## Rules — Project-Specific');
    const idxGen = next!.indexOf('## Rules — Global');
    const idxGit = next!.indexOf('## Git Policy');
    const idxSkills = next!.indexOf('## Skills');
    expect(idxPs).toBeGreaterThan(-1);
    expect(idxGen).toBeGreaterThan(-1);
    expect(idxPs).toBeLessThan(idxGen);
    expect(idxGen).toBeLessThan(idxGit);
    expect(idxGit).toBeLessThan(idxSkills);
  });

  it('places Project-Specific above General when template PS was only appended at the end', () => {
    const targetNoPs = `# Title

## Skills — Extra

KEEP_SKILLS

## Rules — Global

OLD_GENERAL

---

## Rules — Markdown Tables

OLD_MD

---

## Git Policy

OLD_GIT

---
`;

    const next = mergeAgentsFromTemplate(targetNoPs, template);
    expect(next).not.toBeNull();
    expect(next).toContain('TEMPLATE_PS');
    expect(next).toContain('KEEP_SKILLS');
    const idxPs = next!.indexOf('TEMPLATE_PS');
    const idxGen = next!.indexOf('TEMPLATE_GENERAL');
    const idxGit = next!.indexOf('TEMPLATE_GIT');
    const idxSkillsHeading = next!.indexOf('## Skills');
    expect(idxPs).toBeLessThan(idxGen);
    expect(idxGen).toBeLessThan(idxGit);
    expect(idxGit).toBeLessThan(idxSkillsHeading);
  });

  it('returns null when output equals target', () => {
    const aligned = mergeAgentsFromTemplate(template, template);
    expect(aligned).toBeNull();
  });

  it('extractRulesGeneralSection reads General block', () => {
    expect(extractRulesGeneralSection(template)).toContain('TEMPLATE_GENERAL');
  });
});
