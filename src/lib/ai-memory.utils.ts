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

/** Transitional pointer written to legacy `.claude/memory.md` after migration. */
export const CLAUDE_MEMORY_POINTER_MARKDOWN = `# Moved

The canonical session log for this repo now lives at:

- \`.agents/memory.md\`

Use that file for current-session checklists and recent working memory.
\`.agents/handoff.md\` remains the current project-state snapshot.

This compatibility pointer is deprecated and should be removed after:

- \`2026-07-31\`
`;

const POINTER_MARKERS = ['# Moved', 'canonical session log', '.agents/memory.md'] as const;

/** True when content is the transitional pointer (or substantially equivalent). */
export function isClaudeMemoryPointerContent(content: string): boolean {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return false;
  }
  return POINTER_MARKERS.every((marker) => trimmed.includes(marker));
}

/** True when legacy `.claude/memory.md` has substantive session content worth migrating. */
export function isMigratableClaudeMemoryContent(content: string): boolean {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return false;
  }
  if (isClaudeMemoryPointerContent(trimmed)) {
    return false;
  }
  return true;
}

/** True when `CLAUDE.md` is the minimal shim (`@AGENTS.md` or equivalent link). */
export function isMinimalClaudeMdContent(content: string): boolean {
  const trimmed = content.trim();
  return trimmed === '@AGENTS.md' || trimmed === 'See [AGENTS.md](./AGENTS.md).';
}

/** Append legacy Claude memory under a clearly marked section when not already present. */
export function mergeClaudeMemoryIntoAgentsMemory(agentsMemory: string, claudeMemory: string): string {
  const base = agentsMemory.endsWith('\n') ? agentsMemory : `${agentsMemory}\n`;
  const marker = '## Imported from `.claude/memory.md`';
  if (base.includes(marker)) {
    return agentsMemory;
  }
  const body = claudeMemory.trim();
  return `${base}\n${marker}\n\n${body}\n`;
}

/** Create or merge legacy Claude handoff into `.agents/handoff.md`. */
export function mergeClaudeHandoffIntoAgentsHandoff(agentsHandoff: string, claudeHandoff: string): string {
  const marker = '## Imported from `.claude/handoff.md`';
  if (agentsHandoff.includes(marker)) {
    return agentsHandoff;
  }
  if (agentsHandoff.trim().length === 0) {
    return `${claudeHandoff.trim()}\n`;
  }
  const base = agentsHandoff.endsWith('\n') ? agentsHandoff : `${agentsHandoff}\n`;
  return `${base}\n${marker}\n\n${claudeHandoff.trim()}\n`;
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
