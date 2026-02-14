import type { PackageConfig } from '@finografic/core';

export interface GeneratorContext {
  cwd: string;
  targetDir: string;
  config: PackageConfig;
  features: {
    aiInstructions: boolean;
    aiClaude: boolean;
    vitest: boolean;
    githubWorkflow: boolean;
  };
}
