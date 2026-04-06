export type DependencySection = 'dependencies' | 'devDependencies';

export interface DependencyRule {
  name: string;
  /** Version spec. Use undefined to explicitly skip version pinning for this rule. */
  version: string | undefined;
  section: DependencySection;
  /** When true, only updates if already present — never adds to a project that doesn't have it. */
  optional?: boolean;
}
