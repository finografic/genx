import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileExists } from 'utils';

const OXFMT_CONFIG_FILENAME = 'oxfmt.config.ts';

const OXFMT_CONFIG_BODY = `import {
  AGENT_DOC_MARKDOWN_PATHS,
  agentMarkdown,
  base,
  ignorePatterns,
  json,
  markdown,
  sorting,
  typescript,
} from '@finografic/oxfmt-config';
import { defineConfig } from 'oxfmt';

export default defineConfig({
  $schema: './node_modules/oxfmt/configuration_schema.json',
  ignorePatterns: [...ignorePatterns],
  ...base,
  ...typescript,
  ...sorting,
  overrides: [
    { files: ['*.ts', '*.tsx'], excludeFiles: [], options: { ...typescript } },
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
  ],
} satisfies ReturnType<typeof defineConfig>);
`;

export interface EnsureOxfmtConfigOptions {
  force?: boolean;
}

/**
 * Ensure \`oxfmt.config.ts\` exists in the target directory (base preset — no CSS override;
 * the css feature adds CSS when applied).
 */
export async function ensureOxfmtConfig(
  targetDir: string,
  options: EnsureOxfmtConfigOptions = {},
): Promise<{ wrote: boolean; path: string }> {
  const path = join(targetDir, OXFMT_CONFIG_FILENAME);

  if (!options.force && fileExists(path)) {
    return { wrote: false, path };
  }

  await writeFile(path, `${OXFMT_CONFIG_BODY}\n`, 'utf8');
  return { wrote: true, path };
}
