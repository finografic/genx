/** Legacy AGENTS.md section replaced by {@link PROJECT_MEMORY_MODEL_AGENTS_SECTION_BODY}. */
export const LEGACY_CLAUDE_AGENTS_SECTION_HEADING = 'Claude Code — Session Memory and Handoff';

/** Canonical H2 heading for the project memory model block in AGENTS.md. */
export const PROJECT_MEMORY_MODEL_AGENTS_SECTION_HEADING = 'Project Memory Model';

/** Exact body (without `##` heading) synced from `_templates/AGENTS.md.template`. */
export const PROJECT_MEMORY_MODEL_AGENTS_SECTION_BODY = `- \`docs/todo/ROADMAP.md\` = curated milestone plan + completed milestone history.
- \`docs/todo/NEXT_STEPS.md\` = near-term working list, manual testing, and small follow-ups.
- \`.agents/handoff.md\` = current project state snapshot.
- \`.agents/memory.md\` = chronological working memory / session log.

Promotion rule:

- session detail, partial work, and temporary context belong in \`.agents/memory.md\`
- stable current truth belongs in \`.agents/handoff.md\`
- project priorities and completed milestone-scale work belong in \`ROADMAP.md\`
- small actionable follow-ups and manual verification belong in \`NEXT_STEPS.md\`

Do not duplicate the same item across all four files unless it truly belongs in each role.

Reference: [\`docs/process/PROJECT_MEMORY_MODEL.md\`](./docs/process/PROJECT_MEMORY_MODEL.md)`;

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
