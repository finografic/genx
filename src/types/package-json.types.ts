export type PackageJson = Record<string, unknown> & {
  name?: string;
  keywords?: unknown;
  scripts?: Record<string, string>;
  'lint-staged'?: Record<string, string[]>;
};
