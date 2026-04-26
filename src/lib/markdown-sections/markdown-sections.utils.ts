import type { MarkdownSection, ParsedMarkdown, SectionPosition } from './markdown-sections.types.js';

// ─── Parsing ──────────────────────────────────────────────────────────────────

/**
 * Parse a markdown file into a preamble and an ordered list of `##` sections.
 *
 * Splits on H2 (`## `) boundaries only. H3+ headings and `##`-like strings inside fenced code blocks are
 * preserved verbatim in the section body.
 *
 * The round-trip `serializeSections(parseSections(content)) === content` holds for all well-formed markdown
 * files (no normalisation applied).
 */
export function parseSections(content: string): ParsedMarkdown {
  // Split at every point where a line starts with "## ", keeping the heading
  // as the first element of each resulting chunk (positive lookahead).
  const parts = content.split(/^(?=## )/m);

  // When the file starts with "## ", JS engines do not emit an empty-string
  // prefix for the zero-width match at position 0, so parts[0] already IS the
  // first section chunk. When the file starts with a preamble (H1, prose, etc.)
  // parts[0] is that preamble text and section chunks begin at index 1.
  const firstIsSection = parts[0]?.startsWith('## ') ?? false;
  const preamble = firstIsSection ? '' : (parts[0] ?? '');
  const sectionParts = firstIsSection ? parts : parts.slice(1);

  const sections: MarkdownSection[] = [];
  for (const part of sectionParts) {
    const newlineIdx = part.indexOf('\n');
    if (newlineIdx === -1) {
      // Heading with no newline — edge case, treat body as empty
      sections.push({ heading: part, body: '' });
    } else {
      sections.push({ heading: part.slice(0, newlineIdx), body: part.slice(newlineIdx + 1) });
    }
  }

  return { preamble, sections };
}

/**
 * Serialize a `ParsedMarkdown` back to a string. This is the exact inverse of `parseSections` — no formatting
 * is applied.
 */
export function serializeSections({ preamble, sections }: ParsedMarkdown): string {
  return preamble + sections.map(({ heading, body }) => `${heading}\n${body}`).join('');
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Normalise a heading identifier to its full `## …` form. Accepts either `'## Foo'` or just `'Foo'`.
 */
function normalizeHeading(text: string): string {
  return text.startsWith('## ') ? text : `## ${text}`;
}

/**
 * Return the index of the section whose heading matches `headingText`. Matching is exact and case-sensitive
 * against the heading text with or without the leading `## `. Returns `-1` when not found.
 */
export function findSectionIndex(parsed: ParsedMarkdown, headingText: string): number {
  const target = normalizeHeading(headingText);
  return parsed.sections.findIndex((s) => s.heading === target);
}

/** Return `true` when a section with the given heading exists. */
export function hasSection(parsed: ParsedMarkdown, headingText: string): boolean {
  return findSectionIndex(parsed, headingText) !== -1;
}

/**
 * Return the subset of `required` headings that are absent from `parsed`. Useful for detect logic: if the
 * result is empty, all required sections exist.
 */
export function getMissingHeadings(parsed: ParsedMarkdown, required: string[]): string[] {
  return required.filter((h) => !hasSection(parsed, h));
}

// ─── Mutations ────────────────────────────────────────────────────────────────
// All mutation functions return a new ParsedMarkdown and never modify the input.

/**
 * Upsert a section by heading text.
 *
 * - **Update:** if a section with `headingText` already exists, its body is replaced in-place (heading and
 *   position are preserved).
 * - **Insert:** if absent, the section is inserted according to `position` (default: `{ atEnd: true }`).
 *
 * **Body format convention:** Start with `\n` for a blank line after the heading. End with `\n\n` when more
 * sections follow, or `\n` for the final section. The serialiser adds no extra spacing — what you pass is
 * what gets written.
 */
export function setSection(
  parsed: ParsedMarkdown,
  headingText: string,
  body: string,
  position: SectionPosition = { atEnd: true },
): ParsedMarkdown {
  const heading = normalizeHeading(headingText);
  const idx = findSectionIndex(parsed, headingText);

  if (idx !== -1) {
    // Update in-place — preserve position, just replace body
    const sections = [...parsed.sections];
    sections[idx] = { heading, body };
    return { ...parsed, sections };
  }

  // Insert at the requested position
  return insertSection(parsed, headingText, body, position);
}

/**
 * Insert a new section at `position`. If a section with `headingText` already exists, the input is returned
 * unchanged.
 */
export function insertSection(
  parsed: ParsedMarkdown,
  headingText: string,
  body: string,
  position: SectionPosition = { atEnd: true },
): ParsedMarkdown {
  if (hasSection(parsed, headingText)) return parsed;

  const heading = normalizeHeading(headingText);
  const newSection: MarkdownSection = { heading, body };
  const sections = [...parsed.sections];

  if ('atStart' in position) {
    return { ...parsed, sections: [newSection, ...sections] };
  }

  if ('atEnd' in position) {
    return { ...parsed, sections: [...sections, newSection] };
  }

  if ('before' in position) {
    const anchor = findSectionIndex(parsed, position.before);
    const insertAt = anchor === -1 ? sections.length : anchor;
    sections.splice(insertAt, 0, newSection);
    return { ...parsed, sections };
  }

  // after
  const anchor = findSectionIndex(parsed, position.after);
  const insertAt = anchor === -1 ? sections.length : anchor + 1;
  sections.splice(insertAt, 0, newSection);
  return { ...parsed, sections };
}

/**
 * Remove the section with `headingText`. Returns the input unchanged when the section does not exist.
 */
export function deleteSection(parsed: ParsedMarkdown, headingText: string): ParsedMarkdown {
  const idx = findSectionIndex(parsed, headingText);
  if (idx === -1) return parsed;
  return { ...parsed, sections: parsed.sections.filter((_, i) => i !== idx) };
}

/**
 * Reorder sections to match `headingOrder`.
 *
 * Sections named in `headingOrder` appear first, in that order. Sections absent from `headingOrder` follow in
 * their original relative order. Entries in `headingOrder` that do not exist in `parsed` are silently
 * skipped.
 */
export function reorderSections(parsed: ParsedMarkdown, headingOrder: string[]): ParsedMarkdown {
  const normalizedOrder = headingOrder.map(normalizeHeading);
  const remaining = [...parsed.sections];
  const ordered: MarkdownSection[] = [];

  for (const target of normalizedOrder) {
    const idx = remaining.findIndex((s) => s.heading === target);
    if (idx !== -1) {
      ordered.push(remaining[idx]!);
      remaining.splice(idx, 1);
    }
  }

  return { ...parsed, sections: [...ordered, ...remaining] };
}
