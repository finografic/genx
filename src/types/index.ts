export interface PackageConfig {
  name: string;
  scope: string;
  description: string;
  author: {
    name: string;
    email: string;
    url: string;
  };
}

export interface GeneratorContext {
  cwd: string;
  targetDir: string;
  config: PackageConfig;
  features: {
    aiRules: boolean;
    vitest: boolean;
    githubWorkflow: boolean;
  };
}

export type TemplateVars = Record<string, string>;

