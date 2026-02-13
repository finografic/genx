import type { FeatureId } from 'features/feature.types';

/**
 * Package type definition.
 * Each type configures how the scaffolded package is shaped.
 */
export interface PackageType {
  /** Unique identifier for the package type */
  id: string;
  /** Display label for prompts */
  label: string;
  /** Description shown as hint in prompts */
  description: string;
  /** Defaults merged into the generated package.json */
  packageJsonDefaults: Record<string, unknown>;
  /** Entry point files the type expects */
  entryPoints: string[];
  /** Keywords added to package.json */
  keywords: string[];
  /** Scripts merged into package.json (on top of the base template) */
  scripts?: Record<string, string>;
  /** Features pre-selected by default for this type */
  defaultFeatures: FeatureId[];
  /** ESLint configuration driven by package type */
  eslint: {
    /** Which globals presets to include */
    globals: ('node' | 'browser')[];
  };
}
