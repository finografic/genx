import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

import type { TemplateVars } from 'types/template.types';
import { applyTemplate } from './template.utils';

/**
 * Copy a template file with token replacement.
 */
export async function copyTemplate(
  src: string,
  dest: string,
  vars: TemplateVars,
): Promise<void> {
  const content = await readFile(src, 'utf8');
  const result = applyTemplate(content, vars);

  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, result, 'utf8');
}

/**
 * Copy a file without modification.
 */
export async function copyFileDirect(src: string, dest: string): Promise<void> {
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(src, dest);
}

/**
 * Copy an entire directory recursively with token replacement.
 */
export async function copyDir(
  src: string,
  dest: string,
  vars: TemplateVars,
  options: {
    templateExtensions?: string[];
    ignore?: string[];
  } = {},
): Promise<void> {
  return copyDirInternal(src, dest, vars, options, src);
}

async function copyDirInternal(
  currentSrc: string,
  currentDest: string,
  vars: TemplateVars,
  options: {
    templateExtensions?: string[];
    ignore?: string[];
  },
  rootSrc: string,
): Promise<void> {
  const { templateExtensions = ['.json', '.ts', '.md', '.yml', '.yaml', '.mjs', '.js'], ignore = [] } =
    options;

  const entries = await readdir(currentSrc, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(currentSrc, entry.name);
    const destPath = join(currentDest, entry.name);
    const relativePath = relative(rootSrc, srcPath);

    if (ignore.some((ignorePattern) => relativePath.startsWith(ignorePattern))) {
      continue;
    }

    if (entry.isDirectory()) {
      await mkdir(destPath, { recursive: true });
      await copyDirInternal(srcPath, destPath, vars, options, rootSrc);
    } else if (entry.isFile()) {
      const shouldTemplate = templateExtensions.some((ext) => entry.name.endsWith(ext));

      if (shouldTemplate) {
        await copyTemplate(srcPath, destPath, vars);
      } else {
        await copyFileDirect(srcPath, destPath);
      }
    }
  }
}

/**
 * Check if a directory exists and is empty.
 */
export async function isDirEmpty(path: string): Promise<boolean> {
  if (!existsSync(path)) return true;

  const entries = await readdir(path);
  return entries.length === 0;
}

/**
 * Ensure a directory exists.
 */
export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

/**
 * Check if a file exists.
 */
export function fileExists(path: string): boolean {
  return existsSync(path);
}
