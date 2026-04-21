import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileExists } from 'utils';

const OXFMT_CONFIG_FILENAME = 'oxfmt.config.ts';

/**
 * Canonical `oxfmt.config.ts` aligned with `_templates/oxfmt.config.ts` (formatter presets from
 * `@finografic/oxc-config`).
 */
export const OXFMT_CONFIG_BODY = `import {
  AGENT_DOC_MARKDOWN_PATHS,
  agentMarkdown,
  base,
  ignorePatterns,
  json,
  markdown,
  sorting,
} from '@finografic/oxc-config/oxfmt';
import { defineConfig } from 'oxfmt';
import type { OxfmtConfig, OxfmtOverrideConfig } from 'oxfmt';

export default defineConfig({
  ignorePatterns: [...ignorePatterns],
  ...base,
  ...sorting,
  overrides: [
    { files: ['*.json', '*.jsonc'], excludeFiles: [], options: { ...json } },
    {
      files: ['*.md', '*.mdx'],
      excludeFiles: [...AGENT_DOC_MARKDOWN_PATHS],
      options: { ...markdown },
    },
    {
      files: [...AGENT_DOC_MARKDOWN_PATHS],
      excludeFiles: [],
      options: { ...agentMarkdown },
    },
  ] satisfies OxfmtOverrideConfig[],
} satisfies OxfmtConfig);
`;

/** File contents written by {@link ensureOxfmtConfig} — used by preview/detection. */
export function getOxfmtConfigCanonicalFileContent(): string {
  return `${OXFMT_CONFIG_BODY}\n`;
}

export interface EnsureOxfmtConfigOptions {
  force?: boolean;
}

/**
 * Ensure `oxfmt.config.ts` exists in the target directory (aligned with repo `_templates/`; CSS/SCSS override
 * is NOT included — the **css** feature adds it when applied).
 */
export async function ensureOxfmtConfig(
  targetDir: string,
  options: EnsureOxfmtConfigOptions = {},
): Promise<{ wrote: boolean; path: string }> {
  const path = join(targetDir, OXFMT_CONFIG_FILENAME);

  if (!options.force && fileExists(path)) {
    return { wrote: false, path };
  }

  await writeFile(path, getOxfmtConfigCanonicalFileContent(), 'utf8');
  return { wrote: true, path };
}
