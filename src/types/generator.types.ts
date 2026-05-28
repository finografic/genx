import type { PackageConfig } from '@finografic/core';

export interface GeneratorContext {
  cwd: string;
  targetDir: string;
  config: PackageConfig;
  features: {
    aiInstructions: boolean;
    aiMemory: boolean;
    vitest: boolean;
    githubWorkflow: boolean;
  };
}
