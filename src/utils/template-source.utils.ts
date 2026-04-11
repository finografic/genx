import { resolve } from 'node:path';

/**
 * Files stored in `_templates/` with a `.template` suffix so they are not mistaken for
 * live agent docs at repo root. When copying or reading for output, use the key (target basename).
 */
export const TEMPLATE_DOT_TEMPLATE_BY_OUTPUT: Readonly<Record<string, string>> = {
  'AGENTS.md': 'AGENTS.md.template',
  'CLAUDE.md': 'CLAUDE.md.template',
};

/**
 * Resolve the path to a bundled template file under `templateDir` for a given **output**
 * path (what appears in created/migrated packages). Maps `AGENTS.md` → `AGENTS.md.template`,
 * `CLAUDE.md` → `CLAUDE.md.template`; other paths are unchanged.
 */
export function resolveTemplateSourcePath(templateDir: string, outputRelativePath: string): string {
  const parts = outputRelativePath.split(/[/\\]/);
  const basename = parts.pop() ?? outputRelativePath;
  const mapped = TEMPLATE_DOT_TEMPLATE_BY_OUTPUT[basename];
  if (mapped !== undefined) {
    return resolve(templateDir, ...parts, mapped);
  }
  return resolve(templateDir, outputRelativePath);
}
