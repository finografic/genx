/** Legacy AGENTS.md section replaced by {@link PROJECT_MEMORY_MODEL_AGENTS_SECTION_BODY}. */
export const LEGACY_CLAUDE_AGENTS_SECTION_HEADING = 'Claude Code — Session Memory and Handoff';

/** Canonical H2 heading for the project memory model block in AGENTS.md. */
export const PROJECT_MEMORY_MODEL_AGENTS_SECTION_HEADING = 'Project Memory Model';

/** Exact body (without `##` heading) synced from `_templates/AGENTS.md.template`. */
export const PROJECT_MEMORY_MODEL_AGENTS_SECTION_BODY = `- \`docs/todo/ROADMAP.md\` = milestone plan, near-term tasks, and completed history.
- \`.agents/handoff.md\` = stable current project state.
- \`.agents/memory.md\` = chronological session log.

Promote durable findings from memory → handoff, priorities and follow-ups → roadmap.

Reference: [\`docs/process/PROJECT_MEMORY_MODEL.md\`](./docs/process/PROJECT_MEMORY_MODEL.md)`;

function cleanLegacyNextStepsContent(nextSteps: string): string {
  return nextSteps
    .replace(/^# .*\n+/, '')
    .replace(/^Near-term working list, manual testing, and small follow-ups\.\n+/m, '')
    .replace(/^## Active\n+/m, '')
    .trim();
}

function hasOnlyEmptyNextSteps(content: string): boolean {
  const cleaned = cleanLegacyNextStepsContent(content);
  return cleaned.length === 0 || /^No active follow-ups\.?$/i.test(cleaned);
}

function insertBeforeFirstHeadingAfterIntro(roadmap: string, section: string): string {
  const trimmed = roadmap.trimEnd();
  const firstPriorityHeading = trimmed.search(/^## P\d\b/m);
  if (firstPriorityHeading === -1) {
    return `${trimmed}\n\n${section}\n`;
  }
  return `${trimmed.slice(0, firstPriorityHeading).trimEnd()}\n\n${section}\n\n${trimmed.slice(firstPriorityHeading).trimStart()}\n`;
}

/** Merge legacy NEXT_STEPS content into the ROADMAP Next section. */
export function mergeNextStepsIntoRoadmap(roadmap: string, nextSteps: string): string {
  const base = roadmap.trimEnd();
  if (/^## Next$/m.test(base)) {
    const cleaned = cleanLegacyNextStepsContent(nextSteps);
    if (cleaned.length === 0 || base.includes(cleaned)) {
      return `${base}\n`;
    }
    return base.replace(/^## Next\n([\s\S]*?)(?=^## |\s*$)/m, (match) => {
      const section = match.trimEnd();
      if (/No active (?:follow-ups|items)\.?/i.test(section)) {
        return `## Next\n\n${cleaned}\n\n`;
      }
      return `${section}\n\n${cleaned}\n\n`;
    });
  }

  const nextBody = hasOnlyEmptyNextSteps(nextSteps)
    ? 'No active follow-ups.'
    : cleanLegacyNextStepsContent(nextSteps);
  return insertBeforeFirstHeadingAfterIntro(base, `## Next\n\n${nextBody}`);
}

/** True when legacy `.claude/memory.md` has substantive session content worth migrating. */
export function isMigratableClaudeMemoryContent(content: string): boolean {
  const trimmed = content.trim();
  return trimmed.length > 0 && !isClaudeMemoryPointerContent(trimmed);
}

const POINTER_MARKERS = ['# Moved', 'canonical session log', '.agents/memory.md'] as const;

/** True when content is the deprecated transitional pointer and should be deleted without import. */
export function isClaudeMemoryPointerContent(content: string): boolean {
  const trimmed = content.trim();
  return trimmed.length > 0 && POINTER_MARKERS.every((marker) => trimmed.includes(marker));
}

/** True when `CLAUDE.md` is the minimal shim (`@AGENTS.md` or equivalent link). */
export function isMinimalClaudeMdContent(content: string): boolean {
  const trimmed = content.trim();
  return trimmed === '@AGENTS.md' || trimmed === 'See [AGENTS.md](./AGENTS.md).';
}

/** Append legacy Claude memory when its content is not already present. */
export function mergeClaudeMemoryIntoAgentsMemory(agentsMemory: string, claudeMemory: string): string {
  const base = agentsMemory.endsWith('\n') ? agentsMemory : `${agentsMemory}\n`;
  const body = claudeMemory.trim();
  if (body.length === 0 || base.includes(body)) {
    return agentsMemory;
  }
  return `${base}\n${body}\n`;
}

/** Create or merge legacy Claude handoff into `.agents/handoff.md`. */
export function mergeClaudeHandoffIntoAgentsHandoff(agentsHandoff: string, claudeHandoff: string): string {
  const body = claudeHandoff.trim();
  if (body.length === 0 || agentsHandoff.includes(body)) {
    return agentsHandoff;
  }
  if (agentsHandoff.trim().length === 0) {
    return `${body}\n`;
  }
  const base = agentsHandoff.endsWith('\n') ? agentsHandoff : `${agentsHandoff}\n`;
  return `${base}\n${body}\n`;
}

/** Remove legacy import headings while preserving the migrated content beneath them. */
export function stripLegacyClaudeImportHeadings(content: string): string {
  return content.replace(/^## Imported from `\.claude\/(?:memory|handoff)\.md`\n\n?/gm, '');
}

/**
 * Extract the leading `> ...` blockquote — the "How to maintain this file" note that follows the H1.
 * Returns the blockquote lines plus the index range they occupy, or null when there is none.
 */
function findMaintenanceBlock(
  lines: readonly string[],
): { start: number; end: number; block: string[] } | null {
  const headingIndex = lines.findIndex((line) => line.startsWith('# '));
  if (headingIndex === -1) return null;

  let start = headingIndex + 1;
  while (start < lines.length && lines[start]?.trim() === '') start++;
  if (start >= lines.length || !lines[start]?.startsWith('>')) return null;

  let end = start;
  while (end < lines.length && lines[end]?.startsWith('>')) end++;

  return { start, end, block: lines.slice(start, end) };
}

/**
 * Replace a target file's maintenance blockquote with the canonical one from `_templates/`.
 *
 * The blockquote states how the file is maintained, so it is genx-owned and must stay uniform; the
 * body beneath it is project-authored and never touched. A target that has lost its blockquote gets
 * the canonical one reinserted after the H1.
 *
 * Returns null when nothing needs to change, or when the canonical file has no blockquote to copy.
 */
export function syncMaintenanceBlock(content: string, canonical: string): string | null {
  const canonicalBlock = findMaintenanceBlock(canonical.split('\n'));
  if (!canonicalBlock) return null;

  const lines = content.split('\n');
  const current = findMaintenanceBlock(lines);

  if (current) {
    if (current.block.join('\n') === canonicalBlock.block.join('\n')) return null;
    const next = [...lines.slice(0, current.start), ...canonicalBlock.block, ...lines.slice(current.end)];
    return next.join('\n');
  }

  const headingIndex = lines.findIndex((line) => line.startsWith('# '));
  if (headingIndex === -1) return null;
  const next = [
    ...lines.slice(0, headingIndex + 1),
    '',
    ...canonicalBlock.block,
    ...lines.slice(headingIndex + 1),
  ];
  return next.join('\n');
}
