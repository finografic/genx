/**
 * AI Instructions feature configuration.
 *
 * Installs GitHub Copilot instructions and shared `.github/instructions/`.
 */

export const AI_INSTRUCTIONS_FILES = ['.github/copilot-instructions.md', '.github/instructions'] as const;

/** ESLint global-ignore patterns added when this feature is installed */
export const AI_INSTRUCTIONS_ESLINT_IGNORES = ['**/.cursor/hooks/**', '**/.cursor/chats/**'] as const;
