import type { TemplateVars } from '../types/index.js';
import { applyTemplate } from './template.js';

import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

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
    /** File extensions to apply token replacement to */
    templateExtensions?: string[];
    /** Files/dirs to skip (relative to src) */
    ignore?: string[];
  } = {},
): Promise<void> {
  const { templateExtensions = ['.json', '.ts', '.md', '.yml', '.yaml', '.mjs', '.js'], ignore = [] } =
    options;

  const entries = await readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    const relativePath = relative(src, srcPath);

    // Skip ignored paths
    if (ignore.some((pattern) => relativePath.startsWith(pattern))) {
      continue;
    }

    if (entry.isDirectory()) {
      await mkdir(destPath, { recursive: true });
      await copyDir(srcPath, destPath, vars, options);
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

