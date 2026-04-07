import { describe, expect, it } from 'vitest';

import {
  deleteSection,
  findSectionIndex,
  getMissingHeadings,
  hasSection,
  insertSection,
  parseSections,
  reorderSections,
  serializeSections,
  setSection,
} from './markdown-sections.utils';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Minimal two-section markdown file with H1 preamble. */
const TWO_SECTION_DOC = `# Doc Title

## Section A

Body of A.

## Section B

Body of B.
`;

/** Single-section file — edge case for boundary handling. */
const ONE_SECTION_DOC = `# Title

## Only Section

Content here.
`;

/** No sections — preamble only. */
const NO_SECTIONS_DOC = `# Title

Some intro text.
`;

// ─── parseSections ────────────────────────────────────────────────────────────

describe('parseSections', () => {
  it('splits preamble and sections correctly', () => {
    const { preamble, sections } = parseSections(TWO_SECTION_DOC);

    expect(preamble).toBe('# Doc Title\n\n');
    expect(sections).toHaveLength(2);
    expect(sections[0]?.heading).toBe('## Section A');
    expect(sections[1]?.heading).toBe('## Section B');
  });

  it('captures section bodies including surrounding blank lines', () => {
    const { sections } = parseSections(TWO_SECTION_DOC);

    expect(sections[0]?.body).toBe('\nBody of A.\n\n');
    expect(sections[1]?.body).toBe('\nBody of B.\n');
  });

  it('treats content before first ## as preamble', () => {
    const { preamble, sections } = parseSections(NO_SECTIONS_DOC);

    expect(sections).toHaveLength(0);
    expect(preamble).toBe(NO_SECTIONS_DOC);
  });

  it('handles a single-section file', () => {
    const { sections } = parseSections(ONE_SECTION_DOC);

    expect(sections).toHaveLength(1);
    expect(sections[0]?.heading).toBe('## Only Section');
  });

  it('does not split on H3+ headings', () => {
    const doc = `## Parent\n\n### Child\n\nChild content.\n`;
    const { sections } = parseSections(doc);

    expect(sections).toHaveLength(1);
    expect(sections[0]?.body).toContain('### Child');
    expect(sections[0]?.body).toContain('Child content.');
  });

  it('handles a file that starts with ## (no preamble)', () => {
    const doc = `## First\n\nFirst body.\n\n## Second\n\nSecond body.\n`;
    const { preamble, sections } = parseSections(doc);

    expect(preamble).toBe('');
    expect(sections).toHaveLength(2);
    expect(sections[0]?.heading).toBe('## First');
    expect(sections[1]?.heading).toBe('## Second');
  });
});

// ─── serializeSections — round-trip ──────────────────────────────────────────

describe('serializeSections', () => {
  it('round-trips TWO_SECTION_DOC without changes', () => {
    expect(serializeSections(parseSections(TWO_SECTION_DOC))).toBe(TWO_SECTION_DOC);
  });

  it('round-trips ONE_SECTION_DOC without changes', () => {
    expect(serializeSections(parseSections(ONE_SECTION_DOC))).toBe(ONE_SECTION_DOC);
  });

  it('round-trips NO_SECTIONS_DOC without changes', () => {
    expect(serializeSections(parseSections(NO_SECTIONS_DOC))).toBe(NO_SECTIONS_DOC);
  });

  it('round-trips a real-world AGENTS.md-style document', () => {
    const agentsDoc = [
      '# AGENTS.md — AI Assistant Guide\n\n',
      '## Skills — Check Before Implementing\n\nTable content.\n\n---\n\n',
      '## Rules — General\n\nRules content.\n\n---\n\n',
      '## Git Policy\n\nGit rules.\n',
    ].join('');

    expect(serializeSections(parseSections(agentsDoc))).toBe(agentsDoc);
  });
});

// ─── findSectionIndex / hasSection ───────────────────────────────────────────

describe('findSectionIndex', () => {
  it('finds by heading text without ## prefix', () => {
    const parsed = parseSections(TWO_SECTION_DOC);
    expect(findSectionIndex(parsed, 'Section A')).toBe(0);
    expect(findSectionIndex(parsed, 'Section B')).toBe(1);
  });

  it('finds by full ## heading', () => {
    const parsed = parseSections(TWO_SECTION_DOC);
    expect(findSectionIndex(parsed, '## Section A')).toBe(0);
  });

  it('returns -1 for missing sections', () => {
    const parsed = parseSections(TWO_SECTION_DOC);
    expect(findSectionIndex(parsed, 'Nonexistent')).toBe(-1);
  });
});

describe('hasSection', () => {
  it('returns true when section exists', () => {
    expect(hasSection(parseSections(TWO_SECTION_DOC), 'Section A')).toBe(true);
  });

  it('returns false when section is absent', () => {
    expect(hasSection(parseSections(TWO_SECTION_DOC), 'Missing')).toBe(false);
  });
});

// ─── getMissingHeadings ───────────────────────────────────────────────────────

describe('getMissingHeadings', () => {
  it('returns headings that are absent', () => {
    const parsed = parseSections(TWO_SECTION_DOC);
    const missing = getMissingHeadings(parsed, ['Section A', 'Section C']);
    expect(missing).toEqual(['Section C']);
  });

  it('returns empty array when all required sections exist', () => {
    const parsed = parseSections(TWO_SECTION_DOC);
    expect(getMissingHeadings(parsed, ['Section A', 'Section B'])).toEqual([]);
  });
});

// ─── setSection ──────────────────────────────────────────────────────────────

describe('setSection', () => {
  it('updates an existing section body in-place', () => {
    const parsed = parseSections(TWO_SECTION_DOC);
    const result = setSection(parsed, 'Section A', '\nUpdated body.\n\n');

    expect(result.sections[0]?.heading).toBe('## Section A');
    expect(result.sections[0]?.body).toBe('\nUpdated body.\n\n');
    // Section B is unchanged
    expect(result.sections[1]?.body).toBe('\nBody of B.\n');
  });

  it('preserves section order when updating', () => {
    const parsed = parseSections(TWO_SECTION_DOC);
    const result = setSection(parsed, 'Section B', '\nNew B.\n');

    expect(result.sections.map((s) => s.heading)).toEqual(['## Section A', '## Section B']);
  });

  it('appends a new section at end by default', () => {
    const parsed = parseSections(TWO_SECTION_DOC);
    const result = setSection(parsed, 'Section C', '\nNew section.\n');

    expect(result.sections).toHaveLength(3);
    expect(result.sections[2]?.heading).toBe('## Section C');
  });

  it('inserts before an anchor when position.before is given', () => {
    const parsed = parseSections(TWO_SECTION_DOC);
    const result = setSection(parsed, 'Section C', '\nC body.\n', { before: 'Section B' });

    expect(result.sections.map((s) => s.heading)).toEqual(['## Section A', '## Section C', '## Section B']);
  });

  it('inserts after an anchor when position.after is given', () => {
    const parsed = parseSections(TWO_SECTION_DOC);
    const result = setSection(parsed, 'Section C', '\nC body.\n', { after: 'Section A' });

    expect(result.sections.map((s) => s.heading)).toEqual(['## Section A', '## Section C', '## Section B']);
  });

  it('accepts heading text with ## prefix', () => {
    const parsed = parseSections(TWO_SECTION_DOC);
    const result = setSection(parsed, '## Section A', '\nWith prefix.\n\n');

    expect(result.sections[0]?.body).toBe('\nWith prefix.\n\n');
  });

  it('does not mutate the original', () => {
    const parsed = parseSections(TWO_SECTION_DOC);
    const original = serializeSections(parsed);
    setSection(parsed, 'Section A', '\nChanged.\n\n');
    expect(serializeSections(parsed)).toBe(original);
  });
});

// ─── insertSection ────────────────────────────────────────────────────────────

describe('insertSection', () => {
  it('is a no-op when section already exists', () => {
    const parsed = parseSections(TWO_SECTION_DOC);
    const result = insertSection(parsed, 'Section A', '\nDuplicate.\n');

    expect(serializeSections(result)).toBe(serializeSections(parsed));
  });

  it('inserts at start with atStart position', () => {
    const parsed = parseSections(TWO_SECTION_DOC);
    const result = insertSection(parsed, 'New First', '\nFirst.\n\n', { atStart: true });

    expect(result.sections[0]?.heading).toBe('## New First');
  });

  it('inserts at end with atEnd position', () => {
    const parsed = parseSections(TWO_SECTION_DOC);
    const result = insertSection(parsed, 'New Last', '\nLast.\n', { atEnd: true });

    expect(result.sections.at(-1)?.heading).toBe('## New Last');
  });
});

// ─── deleteSection ────────────────────────────────────────────────────────────

describe('deleteSection', () => {
  it('removes a section by heading text', () => {
    const parsed = parseSections(TWO_SECTION_DOC);
    const result = deleteSection(parsed, 'Section A');

    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]?.heading).toBe('## Section B');
  });

  it('is a no-op when section does not exist', () => {
    const parsed = parseSections(TWO_SECTION_DOC);
    const result = deleteSection(parsed, 'Nonexistent');

    expect(serializeSections(result)).toBe(serializeSections(parsed));
  });
});

// ─── reorderSections ─────────────────────────────────────────────────────────

describe('reorderSections', () => {
  it('reorders sections to match the given order', () => {
    const parsed = parseSections(TWO_SECTION_DOC);
    const result = reorderSections(parsed, ['Section B', 'Section A']);

    expect(result.sections.map((s) => s.heading)).toEqual(['## Section B', '## Section A']);
  });

  it('appends sections not in headingOrder after ordered ones', () => {
    const doc = `# Preamble\n\n## A\n\nA.\n\n## B\n\nB.\n\n## C\n\nC.\n`;
    const parsed = parseSections(doc);
    const result = reorderSections(parsed, ['C', 'A']);

    expect(result.sections.map((s) => s.heading)).toEqual(['## C', '## A', '## B']);
  });

  it('silently skips headings not present in parsed', () => {
    const parsed = parseSections(TWO_SECTION_DOC);
    const result = reorderSections(parsed, ['Nonexistent', 'Section B', 'Section A']);

    expect(result.sections.map((s) => s.heading)).toEqual(['## Section B', '## Section A']);
  });

  it('preserves round-trip after reorder', () => {
    const parsed = parseSections(TWO_SECTION_DOC);
    const reordered = reorderSections(parsed, ['Section B', 'Section A']);
    const out = serializeSections(reordered);

    expect(out).toContain('## Section B');
    expect(out).toContain('## Section A');
    expect(out.indexOf('## Section B')).toBeLessThan(out.indexOf('## Section A'));
  });
});
