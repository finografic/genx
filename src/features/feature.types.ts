/**
 * Feature ID type - must match the feature folder name.
 */
export type FeatureId =
  | 'oxc-config'
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
  /** When true, skip per-file confirmation prompts and apply all changes immediately. */
  yesAll?: boolean;
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
   * Absolute paths touched by apply (writes and deletes), in apply order. For follow-up steps that must not
   * depend on human-facing `applied` labels.
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

/** Tri-state install status used by the audit command. */
export type AuditStatus = 'installed' | 'partial' | 'missing';

/** Result returned by a feature's `audit()` function. */
export interface AuditResult {
  status: AuditStatus;
  /** Short hint shown in the audit prompt, e.g. "config out of date". */
  detail?: string;
}

/**
 * Feature definition. Each feature must implement this interface.
 */
export interface Feature {
  /** Unique feature identifier (matches folder name) */
  id: FeatureId;
  /**
   * When set, `genx audit` omits this feature if the target `package.json` `name` equals this value — e.g.
   * do not offer applying oxc-config while inside `@finografic/oxc-config`.
   */
  selfPackageName?: string;
  /** Display label for prompts */
  label: string;
  /** Optional description/hint */
  description?: string;
  /** Optional hint text for prompts */
  hint?: string;
  /** Optional VSCode-specific configuration */
  vscode?: FeatureVSCodeConfig;

  /**
   * Optional detection function to check if feature is already present. Returns true if feature is detected,
   * false otherwise.
   */
  detect?: (context: FeatureContext) => boolean | Promise<boolean>;

  /**
   * Optional tri-state audit function. Returns `installed`, `partial`, or `missing`. When omitted, the audit
   * command falls back to `detect()` and maps the boolean to `installed | missing`.
   */
  audit?: (context: FeatureContext) => Promise<AuditResult>;

  /**
   * Apply the feature to the target directory. This is where the feature's side effects happen.
   */
  apply: (context: FeatureContext) => Promise<FeatureApplyResult>;
}
