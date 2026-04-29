/**
 * Canonical `# Agents`–scoped `.gitignore` lines for `.agents/`, Claude Code, Codex, and worktrees.
 * Used by ai-claude / ai-instructions features and agent-docs migration.
 */
export const CANONICAL_AGENTS_GITIGNORE_LINES = [
  '# Agents',
  '.agents/',
  '!.agents/handoff.md',
  '.codex/',
  '.claude/',
  '!.claude/handoff.md',
  '!.claude/settings.json',
  '.worktrees/',
  '**/worktrees/',
] as const;

/** Rewrite legacy `.ai/` paths to `.agents/` (folder rename). */
export function rewriteDotAiPathsToAgents(content: string): string {
  return content.replace(/\.ai\//g, '.agents/');
}

/**
 * Merge missing canonical agents/claude gitignore lines into existing `.gitignore` content.
 */
export function proposeAgentsGitignoreMerge(content: string): string {
  const unified = content.replace(/\r\n/g, '\n');
  const lines = unified.split('\n');
  const trimmedSet = new Set(lines.map((l) => l.trim()));
  const hasAgentsHeader = lines.some((l) => /^#\s*Agents\b/i.test(l.trim()));

  const missingLines: string[] = [];
  for (const line of CANONICAL_AGENTS_GITIGNORE_LINES) {
    if (line === '# Agents') {
      if (!hasAgentsHeader) {
        missingLines.push(line);
      }
      continue;
    }
    if (!trimmedSet.has(line)) {
      missingLines.push(line);
    }
  }

  if (missingLines.length === 0) {
    return content;
  }

  const base = unified.endsWith('\n') ? unified : `${unified}\n`;
  const spacer = base.trim().length === 0 ? '' : '\n';
  return `${base}${spacer}${missingLines.join('\n')}\n`;
}
