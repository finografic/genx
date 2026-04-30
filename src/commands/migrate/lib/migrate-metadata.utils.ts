import { resolve } from 'node:path';

import { migrateConfig } from 'config/migrate.config';
import type { MigrateOnlySection } from 'types/migrate.types';

interface MigrateArgs {
  targetDir: string;
}

export function parseMigrateArgs(argv: string[], cwd: string): MigrateArgs {
  const args = argv.slice();

  if (args[0] === 'migrate') args.shift();

  let targetDir = cwd;

  for (const arg of args) {
    if (!arg.startsWith('-')) {
      targetDir = resolve(cwd, arg);
    }
  }

  return { targetDir };
}

export function shouldRunSection(only: Set<MigrateOnlySection> | null, section: MigrateOnlySection): boolean {
  if (!only) return true;
  return only.has(section);
}

export function getScopeAndName(pkgName: string | undefined): { scope: string; name: string } | null {
  if (!pkgName) return null;
  if (pkgName.startsWith('@') && pkgName.includes('/')) {
    const [scope, name] = pkgName.split('/');
    return { scope, name };
  }
  return { scope: migrateConfig.defaultScope, name: pkgName };
}
