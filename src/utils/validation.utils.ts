import { join } from 'node:path';

import { z } from 'zod';

import { fileExists } from './fs.utils';

/**
 * Validate package name (scoped or unscoped).
 */
export const packageNameSchema = z
  .string()
  .min(1)
  .regex(/^(@[a-z0-9-]+\/)?[a-z0-9-]+$/, {
    message: 'Package name must be lowercase, alphanumeric, and may contain hyphens',
  });

/**
 * Validate scope (without @ prefix).
 */
export const scopeSchema = z
  .string()
  .min(1)
  .regex(/^@?[a-z0-9-]+$/, {
    message: 'Scope must be lowercase, alphanumeric, and may contain hyphens',
  });

/**
 * Validate package description.
 */
export const descriptionSchema = z.string().min(10).max(200);

/**
 * Validate email.
 */
export const emailSchema = z.string().email();

/**
 * Check if a directory is safe to use as a project target.
 */
export async function validateTargetDir(targetPath: string): Promise<{ ok: boolean; reason?: string }> {
  if (fileExists(targetPath)) {
    const packageJsonPath = join(targetPath, 'package.json');
    if (fileExists(packageJsonPath)) {
      return { ok: false, reason: 'Directory already contains a package.json' };
    }
  }

  return { ok: true };
}

/**
 * Check if current directory is a valid package for "apply" commands.
 */
export function validateExistingPackage(cwd: string): { ok: boolean; reason?: string } {
  const packageJsonPath = join(cwd, 'package.json');

  if (!fileExists(packageJsonPath)) {
    return { ok: false, reason: 'No package.json found in current directory' };
  }

  return { ok: true };
}
