import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileExists } from 'utils';

import { OXFMT_CONFIG_FILENAME } from './css.constants';

function hasCssOverride(content: string): boolean {
  return content.includes("files: ['*.css', '*.scss']") || content.includes('files: ["*.css", "*.scss"]');
}

function hasCssNamedImport(content: string): boolean {
  const importMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]@finografic\/oxfmt-config['"]/s);
  return importMatch !== null && /\bcss\b/.test(importMatch[1]);
}

/**
 * Ensure `css` is imported from `@finografic/oxfmt-config` (insert after `base,`).
 */
export function ensureCssImportInOxfmtConfig(content: string): string {
  if (hasCssNamedImport(content)) return content;
  if (!content.includes('@finografic/oxfmt-config')) return content;

  if (/\n {2}base,\n {2}css,/.test(content)) return content;

  const afterIgnorePatterns = content.replace(/(\n {2}base,)(?=\n {2}ignorePatterns,)/, '$1\n  css,');
  if (afterIgnorePatterns !== content) return afterIgnorePatterns;

  return content.replace(/(\n {2}base,)(?!\n {2}css,)/, '$1\n  css,');
}

/**
 * Append the CSS/SCSS override to `overrides` when using the standard genx template shape.
 */
export function insertCssOverrideInOxfmtConfig(content: string): string {
  if (hasCssOverride(content)) return content;

  const needle = `      options: { ...agentMarkdown },
    },
  ],`;
  if (content.includes(needle)) {
    return content.replace(
      needle,
      `      options: { ...agentMarkdown },
    },
    { files: ['*.css', '*.scss'], excludeFiles: [], options: { ...css } },
  ],`,
    );
  }

  return content.replace(
    /(\n {2}\],)(\n} satisfies ReturnType<typeof defineConfig>)/,
    `\n    { files: ['*.css', '*.scss'], excludeFiles: [], options: { ...css } },$1$2`,
  );
}

/**
 * Add `css` import and CSS/SCSS override to `oxfmt.config.ts` when present.
 */
export async function patchOxfmtConfigForCss(targetDir: string): Promise<boolean> {
  const configPath = resolve(targetDir, OXFMT_CONFIG_FILENAME);
  if (!fileExists(configPath)) return false;

  const raw = await readFile(configPath, 'utf8');
  const normalized = raw.replace(/\r\n/g, '\n');
  let next = ensureCssImportInOxfmtConfig(normalized);
  next = insertCssOverrideInOxfmtConfig(next);

  if (next === normalized) return false;

  await writeFile(configPath, `${next.endsWith('\n') ? next : `${next}\n`}`, 'utf8');
  return true;
}
