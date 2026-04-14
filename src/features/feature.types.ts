/**
 * Feature ID type - must match the feature folder name.
 */
export type FeatureId =
  | 'oxfmt'
  | 'vitest'
  | 'githubWorkflow'
  | 'aiAgents'
  | 'aiClaude'
  | 'aiInstructions'
  | 'markdown'
  | 'gitHooks'
  | 'css';

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
  /**
   * Absolute paths touched by apply (writes and deletes), in apply order.
   * For follow-up steps that must not depend on human-facing `applied` labels.
   */
  appliedTargetPaths?: readonly string[];
}

/**
 * VSCode-specific configuration for a feature.
 */
export interface FeatureVSCodeConfig {
  /** VSCode extension IDs to recommend (e.g., "oxc.oxc-vscode") */
  extensions?: readonly string[];
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
