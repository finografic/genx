import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { confirmFileWrite } from '@finografic/cli-kit/file-diff';
import type { DiffConfirmState } from '@finografic/cli-kit/file-diff';

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
 *
 * A rule only becomes a change when merging would actually alter the file. Reporting every rule
 * whose template and target both exist put `merges: package.json` in the plan on every single run,
 * including runs where the merge was a no-op.
 */
export async function planMerges(
  targetDir: string,
  existingFiles: Set<string>,
  rules: MergeRule[],
  templateDir: string,
  vars: TemplateVars,
): Promise<MergeChange[]> {
  const changes: MergeChange[] = [];

  for (const rule of rules) {
    // Check if both template and existing file exist
    const templatePath = resolve(templateDir, rule.file);
    if (!fileExists(templatePath) || !existingFiles.has(rule.file)) continue;

    // `existingFiles` is the post-rename set, so a file can be listed before the rename that
    // creates it has run. Nothing to compare against yet — report it and let apply decide.
    const existingPath = resolve(targetDir, rule.file);
    if (!fileExists(existingPath)) {
      changes.push({ file: rule.file, strategy: rule.strategy });
      continue;
    }

    const current = await readFile(existingPath, 'utf8');
    const merged = await mergeFile(rule, existingPath, templatePath, vars);
    if (merged !== current) {
      changes.push({ file: rule.file, strategy: rule.strategy });
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
 *
 * Trailing newline matches `writePackageJson` — without it every merge left package.json
 * newline-less and the next commit's formatter rewrote the file.
 */
function mergePackageJson(existingRaw: string, templateRaw: string): string {
  const existing = JSON.parse(existingRaw) as Record<string, unknown>;
  const template = JSON.parse(templateRaw) as Record<string, unknown>;

  const merged = JSON.stringify(
    {
      ...template,
      ...existing,
      scripts: {
        ...(template.scripts as Record<string, string>),
        ...(existing.scripts as Record<string, string>),
      },
    },
    null,
    2,
  );

  return `${merged}\n`;
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
 * Apply file merges, one confirmed decision per file.
 *
 * Returns the number of files actually written.
 */
export async function applyMerges(
  targetDir: string,
  changes: MergeChange[],
  templateDir: string,
  vars: TemplateVars,
  diffState?: DiffConfirmState,
): Promise<number> {
  let written = 0;

  for (const change of changes) {
    const existingPath = resolve(targetDir, change.file);
    const templatePath = resolve(templateDir, change.file);

    const rule: MergeRule = {
      file: change.file,
      strategy: change.strategy,
    };

    // Recomputed against disk rather than reused from the plan: the package-json, node and
    // dependencies operations have already written package.json by this point, and merging
    // content captured at plan time would silently revert them.
    const current = await readFile(existingPath, 'utf8');
    const merged = await mergeFile(rule, existingPath, templatePath, vars);

    // `confirmFileWrite` returns 'skip' without prompting when the contents match, so a merge that
    // earlier operations already satisfied stays silent.
    const action = await confirmFileWrite(existingPath, current, merged, diffState);
    if (action === 'skip') continue;

    await writeFile(existingPath, merged, 'utf8');
    written += 1;
  }

  return written;
}
