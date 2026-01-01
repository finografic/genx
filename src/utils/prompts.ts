import type { PackageConfig } from '../types/index.js';
import { descriptionSchema, emailSchema,packageNameSchema, scopeSchema } from './validation.js';

import * as clack from '@clack/prompts';
import pc from 'picocolors';

export function intro(message: string): void {
  clack.intro(pc.bgCyan(pc.black(` ${message} `)));
}

export function outro(message: string): void {
  clack.outro(pc.green(message));
}

export function errorMessage(message: string): void {
  clack.log.error(pc.red(message));
}

export function successMessage(message: string): void {
  clack.log.success(pc.green(message));
}

export function infoMessage(message: string): void {
  clack.log.info(pc.cyan(message));
}

/**
 * Prompt for package configuration.
 */
export async function promptPackageConfig(): Promise<PackageConfig | null> {
  const scope = await clack.text({
    message: 'Package scope (without @):',
    placeholder: 'finografic',
    validate: (value) => {
      const result = scopeSchema.safeParse(value);
      return result.success ? undefined : result.error.issues[0].message;
    },
  });

  if (clack.isCancel(scope)) {
    clack.cancel('Operation cancelled');
    return null;
  }

  const name = await clack.text({
    message: 'Package name:',
    placeholder: 'my-package',
    validate: (value) => {
      const result = packageNameSchema.safeParse(value);
      return result.success ? undefined : result.error.issues[0].message;
    },
  });

  if (clack.isCancel(name)) {
    clack.cancel('Operation cancelled');
    return null;
  }

  const description = await clack.text({
    message: 'Package description:',
    placeholder: 'A cool new package',
    validate: (value) => {
      const result = descriptionSchema.safeParse(value);
      return result.success ? undefined : result.error.issues[0].message;
    },
  });

  if (clack.isCancel(description)) {
    clack.cancel('Operation cancelled');
    return null;
  }

  const authorName = await clack.text({
    message: 'Author name:',
    placeholder: 'Justin',
  });

  if (clack.isCancel(authorName)) {
    clack.cancel('Operation cancelled');
    return null;
  }

  const authorEmail = await clack.text({
    message: 'Author email:',
    placeholder: 'justin@example.com',
    validate: (value) => {
      const result = emailSchema.safeParse(value);
      return result.success ? undefined : result.error.issues[0].message;
    },
  });

  if (clack.isCancel(authorEmail)) {
    clack.cancel('Operation cancelled');
    return null;
  }

  const authorUrl = await clack.text({
    message: 'Author URL:',
    placeholder: 'https://github.com/username',
  });

  if (clack.isCancel(authorUrl)) {
    clack.cancel('Operation cancelled');
    return null;
  }

  return {
    name: name as string,
    scope: scope as string,
    description: description as string,
    author: {
      name: authorName as string,
      email: authorEmail as string,
      url: authorUrl as string,
    },
  };
}

/**
 * Prompt for optional features.
 */
export async function promptFeatures() {
  const features = await clack.multiselect({
    message: 'Select optional features:',
    options: [
      { value: 'aiRules', label: 'AI Rules (.github/copilot-instructions.md)', hint: 'recommended' },
      { value: 'vitest', label: 'Vitest testing setup', hint: 'recommended' },
      { value: 'githubWorkflow', label: 'GitHub release workflow', hint: 'recommended' },
    ],
    required: false,
  });

  if (clack.isCancel(features)) {
    clack.cancel('Operation cancelled');
    return null;
  }

  return {
    aiRules: (features as string[]).includes('aiRules'),
    vitest: (features as string[]).includes('vitest'),
    githubWorkflow: (features as string[]).includes('githubWorkflow'),
  };
}

/**
 * Show a spinner for async operations.
 */
export function spinner() {
  return clack.spinner();
}

