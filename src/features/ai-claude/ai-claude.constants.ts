/**
 * AI Claude feature configuration.
 *
 * Installs Claude Code support: CLAUDE.md, .claude/memory.md, .agents/handoff.md, .claude/settings.json, and
 * .claude/assets/ (preview/apply add .claude/assets/.gitkeep when the directory is missing).
 */

export const AI_CLAUDE_FILES = [
  'CLAUDE.md',
  '.claude/memory.md',
  '.claude/settings.json',
  '.agents/handoff.md',
] as const;

/** Lines to ensure exist in .gitignore for Claude Code */
export const AI_CLAUDE_GITIGNORE_LINES = ['.claude/', '!.claude/settings.json'] as const;

/** ESLint ignore patterns added when this feature is installed */
export const AI_CLAUDE_ESLINT_IGNORES = ['**/.claude/**'] as const;
