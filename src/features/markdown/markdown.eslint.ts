import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileExists } from 'utils';

import { ESLINT_CONFIG_FILES } from 'config/constants.config';

/**
 * Strip `eslint-plugin-markdownlint` imports, the `/// <reference>` to declarations.d.ts,
 * and the `**\/*.md` config block from an ESLint flat-config file body.
 */
export function stripMarkdownlintFromEslintConfigContent(content: string): string {
  let s = content;

  // Remove: /// <reference path="...declarations.d.ts" />
  s = s.replace(/^\/\/\/\s*<reference\s+path=["'][^"']*declarations\.d\.ts["']\s*\/>\s*\r?\n/gim, '');

  // Remove markdownlint plugin imports
  s = s.replace(/^import\s+[\w$]+\s+from\s+['"]eslint-plugin-markdownlint['"]\s*;?\s*\r?\n/gim, '');
  s = s.replace(
    /^import\s+[\w$]+\s+from\s+['"]eslint-plugin-markdownlint\/parser\.js['"]\s*;?\s*\r?\n/gim,
    '',
  );

  // Remove the `**/*.md` config block
  s = stripMarkdownlintConfigBlock(s);

  // Remove `import type { Linter } from 'eslint'` only if Linter is no longer referenced
  const withoutLinterImport = s.replace(
    /^import\s+type\s+\{[^}]*\bLinter\b[^}]*\}\s+from\s+['"]eslint['"]\s*;?\s*\r?\n/gim,
    '',
  );
  if (!withoutLinterImport.includes('Linter')) {
    s = withoutLinterImport;
  }

  // Collapse triple-or-more blank lines left by removal
  s = s.replace(/\n{3,}/g, '\n\n');
  return s;
}

/**
 * Remove the `{ files: ['**\/*.md'], ... }` config object from an ESLint flat config.
 * Uses line-based brace counting starting from the line containing `files: ['**\/*.md']`.
 */
function stripMarkdownlintConfigBlock(content: string): string {
  const mdFilesPattern = /files:\s*\[['"]?\*\*\/\*\.md['"]?\]/;
  const lines = content.split('\n');

  const mdLineIdx = lines.findIndex((l) => mdFilesPattern.test(l));
  if (mdLineIdx === -1) return content;

  // Walk back to the opening `{` for this block
  let blockStartIdx = -1;
  for (let i = mdLineIdx - 1; i >= 0; i--) {
    const trimmed = lines[i]!.trim();
    if (trimmed === '{') {
      blockStartIdx = i;
      break;
    }
    if (trimmed !== '') break; // Non-empty, non-brace line — unexpected shape
  }
  if (blockStartIdx === -1) return content;

  // Count braces to find the matching closing `}`
  let depth = 0;
  let blockEndIdx = -1;
  for (let i = blockStartIdx; i < lines.length; i++) {
    for (const ch of lines[i]!) {
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          blockEndIdx = i;
          break;
        }
      }
    }
    if (blockEndIdx !== -1) break;
  }
  if (blockEndIdx === -1) return content;

  return [...lines.slice(0, blockStartIdx), ...lines.slice(blockEndIdx + 1)].join('\n');
}

/**
 * Propose stripping the markdownlint ESLint config from the first matching `eslint.config.*` file.
 * Returns `{ path, current, proposed }` when a change is needed, or `null` when already clean.
 */
export async function proposeMarkdownlintEslintConfigChange(
  targetDir: string,
): Promise<{ path: string; current: string; proposed: string } | null> {
  for (const name of ESLINT_CONFIG_FILES) {
    const filePath = resolve(targetDir, name);
    if (!fileExists(filePath)) continue;

    const raw = await readFile(filePath, 'utf8');
    if (!raw.includes('eslint-plugin-markdownlint') && !raw.includes("files: ['**/*.md']")) {
      continue;
    }

    const proposed = stripMarkdownlintFromEslintConfigContent(raw);
    if (proposed === raw) continue;

    return { path: filePath, current: raw, proposed };
  }
  return null;
}
