/**
 * AI Claude feature configuration.
 *
 * Installs Claude Code support: CLAUDE.md, .claude/memory.md,
 * .claude/handoff.md, .claude/settings.json, and .claude/assets/.
 */

export const AI_CLAUDE_FILES = [
  'CLAUDE.md',
  '.claude/memory.md',
  '.claude/settings.json',
  '.claude/handoff.md',
] as const;

/** Lines to ensure exist in .gitignore for Claude Code */
export const AI_CLAUDE_GITIGNORE_LINES = [
  '.claude/',
  '!.claude/settings.json',
] as const;
