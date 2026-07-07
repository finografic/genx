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

/** Update handoff maintenance note from legacy Claude paths to the four-file memory model. */
export function updateHandoffMaintenanceNote(content: string): string | null {
  const legacy =
    /— `\.claude\/memory\.md` = session work log\. `\.agents\/handoff\.md` = project state snapshot\./;
  const updated =
    '— `.agents/memory.md` = chronological working memory / session log. `.agents/handoff.md` = current project state snapshot. See `docs/process/PROJECT_MEMORY_MODEL.md`.';
  if (!legacy.test(content)) {
    return null;
  }
  const next = content.replace(legacy, updated);
  return next === content ? null : next;
}
