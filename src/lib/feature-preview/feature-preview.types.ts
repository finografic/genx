import type { FeatureApplyResult } from '../../features/feature.types.js';

/**
 * Whole-file write preview: replace file contents at `path`.
 */
export interface FeaturePreviewChangeWrite {
  kind: 'write';
  path: string;
  currentContent: string;
  proposedContent: string;
  /** User-facing label for feedback (e.g. `remove prettier config`); falls back to `path` when applying. */
  summary?: string;
}

/**
 * Whole-file delete preview: remove `path` when it exists. Use `exists` to distinguish a missing path from an
 * empty file (both may use `currentContent === ''`).
 */
export interface FeaturePreviewChangeDelete {
  kind: 'delete';
  path: string;
  currentContent: string;
  exists: boolean;
  /** User-facing label for feedback; falls back to `path` when applying. */
  summary?: string;
}

export type FeaturePreviewChange = FeaturePreviewChangeWrite | FeaturePreviewChangeDelete;

/**
 * Grouped preview for a feature before apply. `applied` may list paths already satisfied while building the
 * preview (optional context for callers).
 */
export interface FeaturePreviewResult {
  changes: FeaturePreviewChange[];
  applied: string[];
  noopMessage?: string;
  needsInstall?: boolean;
}

export type { FeatureApplyResult };
