import { resolve } from 'node:path';

import { upgradeConfig } from 'config/upgrade.config';
import type { UpgradeOnlySection } from 'types/upgrade.types';

interface UpgradeArgs {
  targetDir: string;
}

export function parseUpgradeArgs(argv: string[], cwd: string): UpgradeArgs {
  const args = argv.slice();

  if (args[0] === 'upgrade') args.shift();

  let targetDir = cwd;

  for (const arg of args) {
    if (!arg.startsWith('-')) {
      targetDir = resolve(cwd, arg);
    }
  }

  return { targetDir };
}

export function shouldRunSection(only: Set<UpgradeOnlySection> | null, section: UpgradeOnlySection): boolean {
  if (!only) return true;
  return only.has(section);
}

export function getScopeAndName(pkgName: string | undefined): { scope: string; name: string } | null {
  if (!pkgName) return null;
  if (pkgName.startsWith('@') && pkgName.includes('/')) {
    const [scope, name] = pkgName.split('/');
    return { scope, name };
  }
  return { scope: upgradeConfig.defaultScope, name: pkgName };
}
