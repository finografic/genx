/**
 * AI Instructions feature configuration.
 *
 * Installs GitHub Copilot instructions, shared .github/instructions/,
 * and Cursor rules (which reference the instructions).
 */

export const AI_INSTRUCTIONS_FILES = [
  '.github/copilot-instructions.md',
  '.github/instructions',
  '.cursor/rules',
] as const;

/** ESLint global-ignore patterns added when this feature is installed (keep `.cursor/rules` lintable) */
export const AI_INSTRUCTIONS_ESLINT_IGNORES = ['**/.cursor/hooks/**', '**/.cursor/chats/**'] as const;
