/** A single `##`-delimited section in a structured markdown file. */
export interface MarkdownSection {
  /**
   * The full heading line, e.g. `## Skills — Check Before Implementing`. Always starts with `## `.
   */
  heading: string;

  /**
   * Everything after the heading's newline until the next `##` heading or end of file. Starts with the blank
   * line (if any) directly after the heading. Ends with `\n\n` when followed by another section, or `\n` at
   * end of file.
   */
  body: string;
}

/** The result of parsing a structured markdown file by its `##` headings. */
export interface ParsedMarkdown {
  /** Content before the first `##` heading (title, preamble, frontmatter). */
  preamble: string;
  /** Sections in document order. */
  sections: MarkdownSection[];
}

/**
 * Where to insert a new section. - `{ before: headingText }` — immediately before the named section - `{
 * after: headingText }` — immediately after the named section - `{ atStart: true }` — before all sections
 * (but after preamble) - `{ atEnd: true }` — after all sections (default when omitted from `setSection`)
 */
export type SectionPosition = { before: string } | { after: string } | { atStart: true } | { atEnd: true };
