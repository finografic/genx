import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileExists } from 'utils';

/** Default workflows that may reference legacy `dprint` format checks. */
export const OXFMT_GITHUB_WORKFLOW_PATHS = [
  '.github/workflows/ci.yml',
  '.github/workflows/release.yml',
] as const;

/**
 * Replace dprint-related commands in a GitHub Actions YAML workflow with `pnpm format.check`.
 */
export function scrubDprintFromWorkflowContent(content: string): { content: string; changed: boolean } {
  let s = content;

  s = s.replace(/pnpm exec dprint check\b/g, 'pnpm format.check');
  s = s.replace(/pnpm dprint check\b/g, 'pnpm format.check');
  s = s.replace(/npx dprint check\b/g, 'pnpm format.check');
  s = s.replace(/\bdprint check\b/g, 'pnpm format.check');
  s = s.replace(/pnpm dprint fmt\b[^\n]*/g, 'pnpm format.check');
  s = s.replace(/pnpm dprint\b[^\n]*/g, 'pnpm format.check');

  s = s.replace(/^(\s*- name:\s*)([^\n]*[dD]print[^\n]*)$/gm, '$1Format check');

  s = s.replace(/^(\s*run:\s*)[^\n]*\bdprint\b[^\n]*$/gm, '$1pnpm format.check');

  return { content: s, changed: s !== content };
}

export async function scrubDprintFromGithubWorkflows(targetDir: string): Promise<{ applied: string[] }> {
  const applied: string[] = [];

  for (const rel of OXFMT_GITHUB_WORKFLOW_PATHS) {
    const abs = resolve(targetDir, rel);
    if (!fileExists(abs)) continue;

    const raw = await readFile(abs, 'utf8');
    const { content, changed } = scrubDprintFromWorkflowContent(raw);
    if (changed) {
      await writeFile(abs, content, 'utf8');
      applied.push(`${rel} (replaced dprint → pnpm format.check)`);
    }
  }

  return { applied };
}
