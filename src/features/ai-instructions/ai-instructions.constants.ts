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
