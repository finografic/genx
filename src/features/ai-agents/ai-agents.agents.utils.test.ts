import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { parseSections } from 'lib/markdown-sections';

import { normalizeHeadingKey } from '../ai-instructions/ai-instructions.agents.utils.js';
import { mergeAgentsMdFromTemplate, reorderAgentsMdSections } from './ai-agents.agents.utils.js';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));

function sectionKeys(content: string): string[] {
  return parseSections(content).sections.map((s) => normalizeHeadingKey(s.heading));
}

describe('ai-agents.agents.utils', () => {
  it('reorders LLAAB-style scrambled AGENTS.md into front matter → spine → learned', async () => {
    const templateContent = await readFile(join(repoRoot, '_templates/AGENTS.md.template'), 'utf8');
    const templateParsed = parseSections(templateContent);

    const scrambled = `# AGENTS.md - AI Assistant Guide

## Rules — Project-Specific

Custom project rules.

## Rules — Global

Global rules.

---

## Git Policy

Git policy body.

---

## Project Memory Model

Memory body from template.

---

## New here and require INITIAL CONTEXT ?

Read manifesto first.

## Roadmap and Planning Docs

Roadmap workflow notes.

## Rules — Markdown Tables (universal)

Duplicate tables section.

---

## Agent Memory Files

Legacy paths list.

---

## Learned User Preferences

- Preference one.

## Learned Workspace Facts

- Fact one.
`;

    const proposed = mergeAgentsMdFromTemplate(scrambled, { templateParsed });
    expect(proposed).not.toBeNull();

    const keys = sectionKeys(proposed!);
    expect(keys.indexOf('new here and require initial context ?')).toBeLessThan(
      keys.indexOf('project memory model'),
    );
    expect(keys.indexOf('project memory model')).toBeLessThan(keys.indexOf('roadmap and planning docs'));
    expect(keys.indexOf('roadmap and planning docs')).toBe(keys.indexOf('project memory model') + 1);
    expect(keys.indexOf('roadmap and planning docs')).toBeLessThan(keys.indexOf('rules - project-specific'));
    expect(keys.indexOf('rules - project-specific')).toBeLessThan(keys.indexOf('git policy'));
    expect(keys.indexOf('git policy')).toBeLessThan(keys.indexOf('learned user preferences'));

    expect(keys).not.toContain('agent memory files');
    expect(keys).not.toContain('claude code - session memory and handoff');
    expect(keys.filter((k) => k.startsWith('rules - markdown tables'))).toHaveLength(1);
  });

  it('mergeAgentsMdFromTemplate is idempotent after reordering a scrambled file', async () => {
    const templateContent = await readFile(join(repoRoot, '_templates/AGENTS.md.template'), 'utf8');
    const templateParsed = parseSections(templateContent);
    const scrambled = `# AGENTS.md

## Git Policy

git

## Project Memory Model

memory

## Rules — Project-Specific

ps
`;
    const once = mergeAgentsMdFromTemplate(scrambled, { templateParsed });
    expect(once).not.toBeNull();
    const twice = mergeAgentsMdFromTemplate(once!, { templateParsed });
    expect(twice).toBeNull();
  });

  it('enforces Roadmap body from template and keeps it adjacent to Project Memory Model', async () => {
    const templateContent = await readFile(join(repoRoot, '_templates/AGENTS.md.template'), 'utf8');
    const templateParsed = parseSections(templateContent);
    const memoryBody =
      templateParsed.sections.find((s) => s.heading === '## Project Memory Model')?.body ?? '';

    const stale = `# AGENTS.md

## Project Memory Model

${memoryBody}

## Roadmap and Planning Docs

**ROADMAP intro line to remove.**

- Old workflow bullet.

## Rules — Project-Specific

ps
`;

    const proposed = mergeAgentsMdFromTemplate(stale, { templateParsed });
    expect(proposed).not.toBeNull();
    expect(proposed).not.toContain('ROADMAP intro line to remove');
    expect(proposed).toContain('check `ROADMAP.md` for existing priorities');

    const keys = sectionKeys(proposed!);
    expect(keys.indexOf('roadmap and planning docs')).toBe(keys.indexOf('project memory model') + 1);
  });

  it('reorderAgentsMdSections places Project Memory Model before Rules spine', () => {
    const parsed = parseSections(`# Title

## Rules — Project-Specific

ps

## Project Memory Model

memory

## Git Policy

git
`);
    const keys = reorderAgentsMdSections(parsed).sections.map((s) => normalizeHeadingKey(s.heading));
    expect(keys.indexOf('project memory model')).toBeLessThan(keys.indexOf('rules - project-specific'));
  });
});
