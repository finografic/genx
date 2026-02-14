/**
 * AI Claude feature configuration.
 *
 * Installs Claude Code support: CLAUDE.md, .claude/memory.md,
 * and .claude/settings.json.
 */

export const AI_CLAUDE_FILES = [
  'CLAUDE.md',
  '.claude/memory.md',
  '.claude/settings.json',
] as const;

/** Lines to ensure exist in .gitignore for Claude Code */
export const AI_CLAUDE_GITIGNORE_LINES = [
  '.claude/',
  '!.claude/settings.json',
] as const;
