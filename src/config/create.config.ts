import { sharedConfig } from './shared.config';

/**
 * Configuration for the create command.
 *
 * Note: create copies the entire templates/package/ directory,
 * so most config is in shared.config.ts (scripts, lint-staged, keywords).
 *
 * This file exists for create-specific settings (e.g., feature flags, ignore patterns).
 */
export const createConfig = {
  /** Default scope for new packages */
  defaultScope: sharedConfig.defaultScope,

  /**
   * Files/directories to ignore when copying templates.
   * These are controlled by feature flags.
   */
  ignorePatterns: {
    /** Ignore AI rules if not selected */
    aiRules: ['.github/copilot-instructions.md', '.github/instructions'],
  },
} as const;
