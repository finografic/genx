import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Find the nearest directory at/above `startDir` that contains a `package.json`. Falls back to `startDir` if
 * none is found (shouldn't happen in normal usage).
 */
export function findPackageRoot(startDir: string): string {
  let dir = startDir;

  // Safety: avoid infinite loops at filesystem root
  while (true) {
    const pkgJson = resolve(dir, 'package.json');
    if (existsSync(pkgJson)) return dir;

    const parent = dirname(dir);
    if (parent === dir) return startDir;
    dir = parent;
  }
}

/**
 * Resolve `_templates` regardless of whether we're running from `src/` or `dist/`.
 */
export function getTemplatesDir(fromDir: string): string {
  const root = findPackageRoot(fromDir);
  return resolve(root, '_templates');
}
