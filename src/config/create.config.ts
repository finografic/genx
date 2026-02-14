import { sharedConfig } from './shared.config';

/**
 * Configuration for the create command.
 *
 * Note: create copies the entire _templates/ directory,
 * so most config is in shared.config.ts (scripts, lint-staged, keywords).
 *
 * This file exists for create-specific settings (e.g., feature flags, ignore patterns).
 */
export interface CreateConfig {
  /** Default scope for new packages */
  defaultScope: string;

  /**
   * Files/directories to ignore when copying templates.
   * These are controlled by feature flags.
   */
  ignorePatterns: {
    /** Ignore AI instructions if not selected */
    aiInstructions: string[];
    /** Ignore Claude Code files if not selected */
    aiClaude: string[];
  };
}

export const createConfig: CreateConfig = {
  /** Default scope for new packages */
  defaultScope: sharedConfig.defaultScope,

  /**
   * Files/directories to ignore when copying templates.
   * These are controlled by feature flags.
   */
  ignorePatterns: {
    /** Ignore AI instructions if not selected */
    aiInstructions: ['.github/copilot-instructions.md', '.github/instructions', '.cursor'],
    /** Ignore Claude Code files if not selected */
    aiClaude: ['CLAUDE.md', '.claude'],
  },
};
