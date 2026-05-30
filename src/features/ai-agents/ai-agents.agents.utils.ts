import {
  ensureBlankLineAfterThematicBreakBeforeHeading,
  findSectionIndex,
  hasSection,
  parseSections,
  serializeSections,
  setSection,
} from 'lib/markdown-sections';
import type { MarkdownSection, ParsedMarkdown } from 'lib/markdown-sections';

import { normalizeHeadingKey } from '../ai-instructions/ai-instructions.agents.utils.js';
import {
  AI_AGENTS_ENFORCED_HEADINGS,
  AI_AGENTS_FRONT_MATTER_HEADING_KEYS,
  AI_AGENTS_REMOVED_SECTION_HEADING_KEYS,
  AI_AGENTS_SEEDED_HEADINGS,
  AI_AGENTS_SPINE_HEADING_KEYS,
} from './ai-agents.constants.js';

function isLearnedSectionKey(key: string): boolean {
  return key.startsWith('learned ');
}

function isMarkdownTablesSectionKey(key: string): boolean {
  return key === 'rules - markdown tables' || key.startsWith('rules - markdown tables ');
}

/** Drop legacy / redundant sections superseded by Project Memory Model. */
export function stripRemovedAgentsSections(sections: readonly MarkdownSection[]): MarkdownSection[] {
  const removed = new Set<string>(AI_AGENTS_REMOVED_SECTION_HEADING_KEYS);
  return sections.filter((s) => !removed.has(normalizeHeadingKey(s.heading)));
}

/**
 * Keep a single Markdown Tables section — prefer the canonical `## Rules — Markdown Tables` heading.
 */
export function dedupeMarkdownTablesSections(sections: readonly MarkdownSection[]): MarkdownSection[] {
  const matches = sections.filter((s) => isMarkdownTablesSectionKey(normalizeHeadingKey(s.heading)));
  if (matches.length <= 1) {
    return [...sections];
  }

  const canonical =
    matches.find((s) => normalizeHeadingKey(s.heading) === 'rules - markdown tables') ?? matches[0];
  const dropKeys = new Set(matches.filter((s) => s !== canonical).map((s) => normalizeHeadingKey(s.heading)));

  return sections.filter((s) => !dropKeys.has(normalizeHeadingKey(s.heading)));
}

/**
 * Canonical AGENTS.md section order after sync:
 *
 * 1. Front matter (INITIAL CONTEXT when present, then Project Memory Model + Roadmap as an adjacent pair)
 * 2. Rules spine (Project-Specific → Global → Markdown Tables → Git Policy)
 * 3. Other project sections (Skills, IMPORTANT, …) in prior relative order
 * 4. Learned sections last
 */
export function reorderAgentsMdSections(parsed: ParsedMarkdown): ParsedMarkdown {
  let remaining = dedupeMarkdownTablesSections(stripRemovedAgentsSections(parsed.sections));
  const ordered: MarkdownSection[] = [];

  for (const key of AI_AGENTS_FRONT_MATTER_HEADING_KEYS) {
    const idx = remaining.findIndex((s) => normalizeHeadingKey(s.heading) === key);
    if (idx !== -1) {
      ordered.push(remaining[idx]);
      remaining = [...remaining.slice(0, idx), ...remaining.slice(idx + 1)];
    }
  }

  for (const key of AI_AGENTS_SPINE_HEADING_KEYS) {
    const idx = remaining.findIndex((s) => normalizeHeadingKey(s.heading) === key);
    if (idx !== -1) {
      ordered.push(remaining[idx]);
      remaining = [...remaining.slice(0, idx), ...remaining.slice(idx + 1)];
    }
  }

  const middle: MarkdownSection[] = [];
  const learned: MarkdownSection[] = [];
  for (const section of remaining) {
    if (isLearnedSectionKey(normalizeHeadingKey(section.heading))) {
      learned.push(section);
    } else {
      middle.push(section);
    }
  }

  return { ...parsed, sections: [...ordered, ...middle, ...learned] };
}

export interface MergeAgentsMdFromTemplateOptions {
  templateParsed: ParsedMarkdown;
}

/**
 * Merge target `AGENTS.md` with `_templates/AGENTS.md.template`: seed/enforce canonical bodies,
 * strip legacy sections, dedupe duplicates, and apply canonical section order.
 *
 * Returns `null` when the normalized result equals the input.
 */
export function mergeAgentsMdFromTemplate(
  currentContent: string,
  options: MergeAgentsMdFromTemplateOptions,
): string | null {
  const { templateParsed } = options;
  let parsed = parseSections(currentContent);
  let changed = false;

  const beforeCount = parsed.sections.length;
  parsed = {
    ...parsed,
    sections: dedupeMarkdownTablesSections(stripRemovedAgentsSections(parsed.sections)),
  };
  if (parsed.sections.length !== beforeCount) {
    changed = true;
  }

  for (const heading of AI_AGENTS_SEEDED_HEADINGS) {
    if (!hasSection(parsed, heading)) {
      const templateSection = templateParsed.sections.find((s) => s.heading === `## ${heading}`);
      if (templateSection) {
        parsed = setSection(parsed, heading, templateSection.body);
        changed = true;
      }
    }
  }

  for (const heading of AI_AGENTS_ENFORCED_HEADINGS) {
    const templateSection = templateParsed.sections.find((s) => s.heading === `## ${heading}`);
    if (!templateSection) continue;

    const idx = findSectionIndex(parsed, heading);
    if (idx === -1) {
      parsed = setSection(parsed, heading, templateSection.body);
      changed = true;
    } else if (parsed.sections[idx]?.body !== templateSection.body) {
      parsed = setSection(parsed, heading, templateSection.body);
      changed = true;
    }
  }

  const reordered = reorderAgentsMdSections(parsed);
  if (reordered.sections.some((s, i) => s.heading !== parsed.sections[i]?.heading)) {
    parsed = reordered;
    changed = true;
  }

  if (!changed) {
    return null;
  }

  return ensureBlankLineAfterThematicBreakBeforeHeading(serializeSections(parsed));
}

/** Reorder `## …` section blocks (full text including heading line) for ai-instructions reverse merge. */
export function reorderAgentsMdFullTextBlocks(mergedFullTextBlocks: readonly string[]): string[] {
  const sections: MarkdownSection[] = mergedFullTextBlocks.map((fullText) => {
    const newlineIdx = fullText.indexOf('\n');
    if (newlineIdx === -1) {
      return { heading: fullText.trimEnd(), body: '' };
    }
    return {
      heading: fullText.slice(0, newlineIdx),
      body: fullText.slice(newlineIdx + 1),
    };
  });
  const reordered = reorderAgentsMdSections({ preamble: '', sections });
  return reordered.sections.map(({ heading, body }) => `${heading}\n${body}`);
}

/** Canonical body for a new `AGENTS.md` copied from the template (includes section reorder). */
export function proposeAgentsMdForNewFile(templateContent: string, templateParsed: ParsedMarkdown): string {
  return (
    mergeAgentsMdFromTemplate(templateContent, { templateParsed }) ??
    ensureBlankLineAfterThematicBreakBeforeHeading(serializeSections(reorderAgentsMdSections(templateParsed)))
  );
}
