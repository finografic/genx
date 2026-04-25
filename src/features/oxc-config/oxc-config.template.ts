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
import type { OxfmtConfig, OxfmtOverrideConfig } from '@finografic/oxc-config/oxfmt';

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

/** Canonical `oxfmt.config.ts` body — used by preview and detection. */
export function getOxfmtConfigCanonicalFileContent(): string {
  return `${OXFMT_CONFIG_BODY}\n`;
}
