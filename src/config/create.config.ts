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
    /** Ignore AI memory model files if not selected */
    aiMemory: string[];
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
    aiInstructions: ['.github/copilot-instructions.md', '.agents/instructions', '.cursor'],
    /**
     * Ignore AI memory model files if not selected.
     *
     * `.agents/handoff.md` and `.agents/memory.md` only — NOT the whole `.agents` directory.
     * `.agents/instructions` (aiInstructions) and `.agents/skills` (aiAgents) share the same parent
     * dir now that everything moved out of `.github/`; a blanket `.agents` entry here would strip
     * their content whenever aiMemory is deselected independently of those other features.
     */
    aiMemory: [
      'CLAUDE.md',
      '.claude/handoff.md',
      '.claude/memory.md',
      'docs/process/PROJECT_MEMORY_MODEL.md',
      'docs/todo',
      '.agents/handoff.md',
      '.agents/memory.md',
    ],
  },
};
