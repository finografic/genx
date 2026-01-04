import { resolve } from 'node:path';

import { migrateConfig } from 'config/migrate.config';
import type { MigrateOnlySection } from 'types/migrate.types';

type MigrateArgs = {
  targetDir: string;
  write: boolean;
  only: Set<MigrateOnlySection> | null;
};

// ------------------------------------------------------------------------ //

export function parseMigrateArgs(argv: string[], cwd: string): MigrateArgs {
  const args = argv.slice();

  // remove command name if present (index.ts passes full argv after selecting command)
  // supports being called directly with `migrate` as argv[0] too
  if (args[0] === 'migrate') args.shift();

  let targetDir = cwd;
  let write = false;
  let only: Set<MigrateOnlySection> | null = null;

  for (const arg of args) {
    if (arg === '--write') {
      write = true;
      continue;
    }
    if (arg.startsWith('--only=')) {
      const raw = arg.slice('--only='.length);
      const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
      only = new Set(parts as MigrateOnlySection[]);
      continue;
    }
    if (!arg.startsWith('-')) {
      targetDir = resolve(cwd, arg);
    }
  }

  return { targetDir, write, only };
}

export function shouldRunSection(only: Set<MigrateOnlySection> | null, section: MigrateOnlySection): boolean {
  if (!only) return true;
  return only.has(section);
}

// ------------------------------------------------------------------------ //

export function getScopeAndName(pkgName: string | undefined): { scope: string; name: string } | null {
  if (!pkgName) return null;
  if (pkgName.startsWith('@') && pkgName.includes('/')) {
    const [scope, name] = pkgName.split('/');
    return { scope, name };
  }
  return { scope: migrateConfig.defaultScope, name: pkgName };
}

export function ensureKeyword(keywords: string[], keyword: string): { keywords: string[]; changed: boolean } {
  if (keywords.some((k) => k.toLowerCase() === keyword.toLowerCase())) {
    return { keywords, changed: false };
  }
  return { keywords: [...keywords, keyword], changed: true };
}
