/**
 * Feature ID type - must match the feature folder name.
 */
export type FeatureId =
  | 'dprint'
  | 'vitest'
  | 'githubWorkflow'
  | 'aiRules'
  | 'markdown'
  | 'gitHooks';

/**
 * Context passed to feature detection and application.
 */
export interface FeatureContext {
  /** Target directory where the feature will be applied */
  targetDir: string;
}

/**
 * Result of applying a feature.
 */
export interface FeatureApplyResult {
  /** List of items that were applied (for user feedback) */
  applied: string[];
  /** Optional message when nothing was changed */
  noopMessage?: string;
  /** Error if application failed */
  error?: Error;
}

/**
 * VSCode-specific configuration for a feature.
 */
export interface FeatureVSCodeConfig {
  /** VSCode extension IDs to recommend (e.g., "dprint.dprint") */
  extensions?: string[];
}

/**
 * Feature definition.
 * Each feature must implement this interface.
 */
export interface Feature {
  /** Unique feature identifier (matches folder name) */
  id: FeatureId;
  /** Display label for prompts */
  label: string;
  /** Optional description/hint */
  description?: string;
  /** Optional hint text for prompts */
  hint?: string;
  /** Optional VSCode-specific configuration */
  vscode?: FeatureVSCodeConfig;

  /**
   * Optional detection function to check if feature is already present.
   * Returns true if feature is detected, false otherwise.
   */
  detect?: (context: FeatureContext) => boolean | Promise<boolean>;

  /**
   * Apply the feature to the target directory.
   * This is where the feature's side effects happen.
   */
  apply: (context: FeatureContext) => Promise<FeatureApplyResult>;
}
