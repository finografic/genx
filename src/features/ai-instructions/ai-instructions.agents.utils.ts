import { ensureBlankLineAfterThematicBreakBeforeHeading } from 'lib/markdown-sections';

/**
 * AGENTS.md sync: **reverse apply** — **`_templates/AGENTS.md.template`** is the canonical source for shared
 * section bodies; target-only `##` sections (e.g. **INITIAL CONTEXT**, Skills, Learned) keep their content.
 * Final section order matches **ai-agents** ({@link reorderAgentsMdFullTextBlocks}): front matter → Rules
 * spine → other extras → Learned last. Legacy sections (Agent Memory Files, Claude handoff) are dropped.
 */

import {
  dedupeMarkdownTablesSections,
  reorderAgentsMdFullTextBlocks,
  stripRemovedAgentsSections,
} from '../ai-agents/ai-agents.agents.utils.js';
import { AI_AGENTS_REMOVED_SECTION_HEADING_KEYS } from '../ai-agents/ai-agents.constants.js';

/** Sections taken verbatim from the template (canonical shared lists). Keys via {@link normalizeHeadingKey}. */
const TEMPLATE_SYNC_KEYS = new Set([
  'project memory model',
  'roadmap and planning docs',
  'rules - global',
  'rules - markdown tables',
  'git policy',
  'cursor',
]);

export interface ParsedAgents {
  preamble: string;
  sections: H2Section[];
}

export interface H2Section {
  start: number;
  end: number;
  headingLine: string;
  fullText: string;
}

/**
 * Normalize an H2 heading line: `## Rules — Global` → `rules - global` (em dash and hyphen equivalent).
 */
export function normalizeHeadingKey(headingLine: string): string {
  const withoutHash = headingLine.replace(/^##\s+/, '').trim();
  return withoutHash
    .toLowerCase()
    .replace(/[—–]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split AGENTS.md into preamble + H2 sections (each `##` through the next `##` or EOF).
 */
export function parseH2Sections(content: string): ParsedAgents {
  const re = /^##[^\n]+$/gm;
  const matches = [...content.matchAll(re)];
  if (matches.length === 0) {
    return { preamble: content, sections: [] };
  }
  const preamble = content.slice(0, matches[0].index);
  const sections: H2Section[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : content.length;
    sections.push({
      start,
      end,
      headingLine: matches[i][0].trim(),
      fullText: content.slice(start, end),
    });
  }
  return { preamble, sections };
}

/**
 * Reverse merge: template supplies shared bodies; target contributes extras and Project-Specific body.
 * Sections are reordered via the same rules as **ai-agents** (see {@link reorderMergedAgentSections}).
 *
 * Returns `null` if the result equals `target` (already aligned).
 */
export function mergeAgentsFromTemplate(target: string, templateContent: string): string | null {
  const { preamble: templatePreamble, sections: tmplSec } = parseH2Sections(templateContent);
  const { sections: tgtSec } = parseH2Sections(target);

  const tmplMap = new Map(tmplSec.map((s) => [normalizeHeadingKey(s.headingLine), s.fullText]));
  const templateKeys = new Set(tmplSec.map((s) => normalizeHeadingKey(s.headingLine)));

  const out: string[] = [];
  const seen = new Set<string>();

  for (const s of tgtSec) {
    const key = normalizeHeadingKey(s.headingLine);
    if ((AI_AGENTS_REMOVED_SECTION_HEADING_KEYS as readonly string[]).includes(key)) {
      continue;
    }
    seen.add(key);

    if (!templateKeys.has(key)) {
      out.push(s.fullText);
      continue;
    }

    if (key === 'rules - project-specific') {
      out.push(s.fullText);
      continue;
    }

    if (TEMPLATE_SYNC_KEYS.has(key) && tmplMap.has(key)) {
      out.push(tmplMap.get(key)!);
      continue;
    }

    out.push(tmplMap.get(key) ?? s.fullText);
  }

  for (const ts of tmplSec) {
    const k = normalizeHeadingKey(ts.headingLine);
    if ((AI_AGENTS_REMOVED_SECTION_HEADING_KEYS as readonly string[]).includes(k)) {
      continue;
    }
    if (!seen.has(k)) {
      out.push(ts.fullText);
    }
  }

  const reordered = reorderMergedAgentSections(out);

  const proposed = ensureTrailingNewline(
    ensureBlankLineAfterThematicBreakBeforeHeading(templatePreamble + reordered.join('')),
  );
  const normalizedTarget = ensureTrailingNewline(target);
  if (proposed === normalizedTarget) {
    return null;
  }
  return proposed;
}

/**
 * Same section order as {@link reorderAgentsMdSections} in ai-agents (front matter → spine → extras →
 * Learned).
 */
function reorderMergedAgentSections(merged: string[]): string[] {
  const sections = merged.map((fullText) => {
    const newlineIdx = fullText.indexOf('\n');
    if (newlineIdx === -1) {
      return { heading: fullText.trimEnd(), body: '' };
    }
    return { heading: fullText.slice(0, newlineIdx), body: fullText.slice(newlineIdx + 1) };
  });
  const stripped = stripRemovedAgentsSections(sections);
  const deduped = dedupeMarkdownTablesSections(stripped);
  return reorderAgentsMdFullTextBlocks(deduped.map(({ heading, body }) => `${heading}\n${body}`));
}

function ensureTrailingNewline(s: string): string {
  return s.endsWith('\n') ? s : `${s}\n`;
}

/** Extract **Rules — Global** section text (for tests / diagnostics). */
export function extractRulesGeneralSection(agentsContent: string): string | null {
  const { sections } = parseH2Sections(agentsContent);
  const hit = sections.find((s) => normalizeHeadingKey(s.headingLine) === 'rules - global');
  return hit ? hit.fullText.trimEnd() : null;
}
