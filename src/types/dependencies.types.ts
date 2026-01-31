export type DependencySection = 'dependencies' | 'devDependencies';

export interface DependencyRule {
  name: string;
  /** Version spec. If omitted, 'latest' will be used during install. */
  version?: string;
  section: DependencySection;
}
