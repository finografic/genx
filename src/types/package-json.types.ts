export type PackageJson = Record<string, unknown> & {
  'name'?: string;
  'keywords'?: unknown;
  'dependencies'?: Record<string, string>;
  'devDependencies'?: Record<string, string>;
  'scripts'?: Record<string, string>;
  'lint-staged'?: Record<string, string[]>;
};
