/**
 * AI Instructions feature configuration.
 *
 * Installs GitHub Copilot instructions and shared `.github/instructions/`.
 */

export const AI_INSTRUCTIONS_FILES = ['.github/copilot-instructions.md', '.github/instructions'] as const;

/**
 * Target package `AGENTS.md` path; merge reads `_templates/AGENTS.md.template` (canonical spine, not any
 * repo’s hand-edited copy).
 */
export const AI_INSTRUCTIONS_AGENTS_MD = 'AGENTS.md' as const;

/** Under `.github/instructions/` — never overwrite from templates (per-repo content). */
export const AI_INSTRUCTIONS_SKIP_SUBDIR = 'project' as const;

/** ESLint global-ignore patterns added when this feature is installed */
export const AI_INSTRUCTIONS_ESLINT_IGNORES = ['**/.cursor/hooks/**', '**/.cursor/chats/**'] as const;
