/**
 * AGENTS.md sync: **reverse apply** — **`_templates/AGENTS.md.template`** is the only canonical layout for
 * the spine (**Rules — Project-Specific** → **Rules — Global** → **Rules — Markdown Tables** → **Git
 * Policy**). Target-only `##` sections (e.g. Skills, Learned) and the **Rules — Project-Specific** body come
 * from the package being migrated; shared blocks are taken from the template file. Do not mirror ordering
 * from a consumer repo’s hand-edited `AGENTS.md` when changing this module — match
 * **`_templates/AGENTS.md.template`**.
 */

/** Sections taken verbatim from the template (canonical shared lists). Keys via {@link normalizeHeadingKey}. */
const TEMPLATE_SYNC_KEYS = new Set(['rules - global', 'rules - markdown tables', 'git policy']);

/**
 * Canonical order for shared “Rules / Git” spine (Project-Specific first). Keys via
 * {@link normalizeHeadingKey}.
 */
const SPINE_KEYS = [
  'rules - project-specific',
  'rules - global',
  'rules - markdown tables',
  'git policy',
] as const;

const SPINE_KEY_SET = new Set<string>(SPINE_KEYS);

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
  const preamble = content.slice(0, matches[0].index!);
  const sections: H2Section[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index!;
    const end = i + 1 < matches.length ? matches[i + 1].index! : content.length;
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
 * Reverse merge: template file is the **base**; target contributes extras and Project-Specific. After merge,
 * sections are **reordered** to match **`_templates/AGENTS.md.template`**: **Rules — Project-Specific**
 * first, then **Rules — Global** → **Markdown Tables** → **Git Policy**, then other extras in merge order,
 * then **Learned** last.
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
    if (!seen.has(k)) {
      out.push(ts.fullText);
    }
  }

  const reordered = reorderMergedAgentSections(out);

  const proposed = ensureTrailingNewline(templatePreamble + reordered.join(''));
  const normalizedTarget = ensureTrailingNewline(target);
  if (proposed === normalizedTarget) {
    return null;
  }
  return proposed;
}

/**
 * After collecting sections, enforce the same vertical order as **`_templates/AGENTS.md.template`**:
 *
 * 1. **Rules — Project-Specific** (first `##` after preamble; fixes PS appended at end when missing from target)
 * 2. **Rules — Global**, **Rules — Markdown Tables**, **Git Policy** (bodies from template where applicable)
 * 3. Other non-spine sections — preserve relative order from `merged`
 * 4. **Learned** sections last — preserve relative order
 */
function reorderMergedAgentSections(merged: string[]): string[] {
  const keyOf = (full: string): string => normalizeHeadingKey(full.split(/\r?\n/, 1)[0] ?? '');
  const isLearned = (key: string): boolean => key.startsWith('learned ');

  const spineParts = new Map<string, string>();
  for (const block of merged) {
    const key = keyOf(block);
    if (SPINE_KEY_SET.has(key)) {
      spineParts.set(key, block);
    }
  }

  const middleExtras: string[] = [];
  for (const block of merged) {
    const key = keyOf(block);
    if (SPINE_KEY_SET.has(key) || isLearned(key)) {
      continue;
    }
    middleExtras.push(block);
  }

  const learned: string[] = [];
  for (const block of merged) {
    if (isLearned(keyOf(block))) {
      learned.push(block);
    }
  }

  const ps = spineParts.get('rules - project-specific');
  const gen = spineParts.get('rules - global');
  const md = spineParts.get('rules - markdown tables');
  const git = spineParts.get('git policy');

  const result: string[] = [];
  if (ps !== undefined) {
    result.push(ps);
  }
  if (gen !== undefined) {
    result.push(gen);
  }
  if (md !== undefined) {
    result.push(md);
  }
  if (git !== undefined) {
    result.push(git);
  }
  result.push(...middleExtras);
  result.push(...learned);
  return result;
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
