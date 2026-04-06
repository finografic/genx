#!/usr/bin/env tsx
/**
 * Scan immediate subdirectories of the current working directory for git repos whose
 * package.json `name` starts with `@finografic/`. Prints `{ "managed": [...] }` as prettified JSON.
 *
 * Usage (from the directory that contains sibling repos, e.g. `~/repos-finografic`):
 *   pnpm list:managed-repos
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/list-managed-repos.ts
 */

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import type { ManagedConfig } from '../src/types/managed.types';

const SCOPE_PREFIX = '@finografic/';

async function main(): Promise<void> {
  // const root = process.cwd();
  const root = resolve(process.cwd(), '..');
  const entries = await readdir(root, { withFileTypes: true });

  const managed: ManagedConfig['managed'] = [];

  for (const dirent of entries) {
    if (!dirent.isDirectory()) continue;

    const repoPath = resolve(root, dirent.name);
    const pkgPath = resolve(repoPath, 'package.json');
    const gitPath = resolve(repoPath, '.git');

    if (!existsSync(pkgPath) || !existsSync(gitPath)) continue;

    let raw: string;
    try {
      raw = await readFile(pkgPath, 'utf8');
    } catch {
      continue;
    }

    let name: unknown;
    try {
      name = (JSON.parse(raw) as { name?: unknown }).name;
    } catch {
      continue;
    }

    if (typeof name !== 'string' || !name.startsWith(SCOPE_PREFIX)) continue;

    managed.push({ name, path: repoPath });
  }

  managed.sort((a, b) => a.name.localeCompare(b.name));

  const out: ManagedConfig = { managed };
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
