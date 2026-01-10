import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { fileExists } from 'utils/fs.utils';
import { applyTemplate } from 'utils/template.utils';
import type { MergeRule } from 'config/merge.rules';
import type { TemplateVars } from 'types/template.types';

export interface MergeChange {
  file: string;
  strategy: MergeRule['strategy'];
}

/**
 * Plan file merges based on existing files and merge rules.
 */
export function planMerges(
  existingFiles: Set<string>,
  rules: MergeRule[],
  templateDir: string,
): MergeChange[] {
  const changes: MergeChange[] = [];

  for (const rule of rules) {
    // Check if both template and existing file exist
    const templatePath = resolve(templateDir, rule.file);
    if (fileExists(templatePath) && existingFiles.has(rule.file)) {
      changes.push({
        file: rule.file,
        strategy: rule.strategy,
      });
    }
  }

  return changes;
}

/**
 * Merge a file based on strategy.
 */
export async function mergeFile(
  rule: MergeRule,
  existingPath: string,
  templatePath: string,
  vars: TemplateVars,
): Promise<string> {
  const existingRaw = await readFile(existingPath, 'utf8');
  const templateRaw = await readFile(templatePath, 'utf8');
  const templateProcessed = applyTemplate(templateRaw, vars);

  switch (rule.strategy) {
    case 'overwrite':
      return templateProcessed;

    case 'shallow-merge':
      return shallowMerge(existingRaw, templateProcessed);

    case 'deep-merge':
      return deepMerge(existingRaw, templateProcessed);

    case 'custom':
      if (rule.file === 'package.json') {
        return mergePackageJson(existingRaw, templateProcessed);
      }
      return templateProcessed;

    default:
      return templateProcessed;
  }
}

/**
 * Custom merge for package.json.
 */
function mergePackageJson(existingRaw: string, templateRaw: string): string {
  const existing = JSON.parse(existingRaw) as Record<string, unknown>;
  const template = JSON.parse(templateRaw) as Record<string, unknown>;

  return JSON.stringify(
    {
      ...template,
      ...existing,
      scripts: {
        ...((template.scripts as Record<string, string>) || {}),
        ...((existing.scripts as Record<string, string>) || {}),
      },
    },
    null,
    2,
  );
}

/**
 * Shallow merge (simple object spread).
 */
function shallowMerge(_existing: string, template: string): string {
  // For non-JSON files, just return template
  // This is a placeholder - implement per file type if needed
  return template;
}

/**
 * Deep merge (recursive object merge).
 */
function deepMerge(_existing: string, template: string): string {
  // For non-JSON files, just return template
  // This is a placeholder - implement per file type if needed
  return template;
}

/**
 * Apply file merges.
 */
export async function applyMerges(
  targetDir: string,
  changes: MergeChange[],
  templateDir: string,
  vars: TemplateVars,
): Promise<void> {
  for (const change of changes) {
    const existingPath = resolve(targetDir, change.file);
    const templatePath = resolve(templateDir, change.file);

    const rule: MergeRule = {
      file: change.file,
      strategy: change.strategy,
    };

    const merged = await mergeFile(rule, existingPath, templatePath, vars);
    await writeFile(existingPath, merged, 'utf8');
  }
}
