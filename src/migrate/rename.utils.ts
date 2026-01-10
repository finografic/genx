import { rename } from 'node:fs/promises';
import { resolve } from 'node:path';

import { fileExists } from 'utils/fs.utils';
import type { RenameRule } from 'config/rename.rules';

export interface RenameChange {
  from: string;
  to: string;
}

/**
 * Plan file renames based on existing files and rename rules.
 */
export function planRenames(existingFiles: Set<string>, rules: RenameRule[]): RenameChange[] {
  const changes: RenameChange[] = [];

  for (const rule of rules) {
    for (const alt of rule.alternatives) {
      if (existingFiles.has(alt) && !existingFiles.has(rule.canonical)) {
        changes.push({ from: alt, to: rule.canonical });
      }
    }
  }

  return changes;
}

/**
 * Get set of existing files in target directory.
 * Checks for all canonical files and their alternatives from rename rules.
 */
export async function getExistingFiles(
  targetDir: string,
  renameRules: RenameRule[],
): Promise<Set<string>> {
  const files = new Set<string>();
  const filesToCheck = new Set<string>();

  // Collect all canonical files and alternatives from rename rules
  for (const rule of renameRules) {
    filesToCheck.add(rule.canonical);
    for (const alt of rule.alternatives) {
      filesToCheck.add(alt);
    }
  }

  // Also check common files that might not be in rename rules
  filesToCheck.add('package.json');

  // Check which files actually exist
  for (const file of filesToCheck) {
    const filePath = resolve(targetDir, file);
    if (fileExists(filePath)) {
      files.add(file);
    }
  }

  return files;
}

/**
 * Apply file renames.
 */
export async function applyRenames(targetDir: string, changes: RenameChange[]): Promise<void> {
  for (const change of changes) {
    const fromPath = resolve(targetDir, change.from);
    const toPath = resolve(targetDir, change.to);

    if (fileExists(fromPath)) {
      await rename(fromPath, toPath);
    }
  }
}
