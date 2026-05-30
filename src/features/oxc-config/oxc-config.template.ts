import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findPackageRoot } from 'utils/package-root.utils';

let cachedOxfmtConfigContent: string | undefined;

/** Canonical `oxfmt.config.ts` from `_templates/oxfmt.config.ts` (single source of truth). */
export function getOxfmtConfigCanonicalFileContent(): string {
  if (cachedOxfmtConfigContent === undefined) {
    const fromDir = fileURLToPath(new URL('.', import.meta.url));
    const pkgRoot = findPackageRoot(fromDir);
    cachedOxfmtConfigContent = readFileSync(join(pkgRoot, '_templates/oxfmt.config.ts'), 'utf8');
  }
  return cachedOxfmtConfigContent.endsWith('\n') ? cachedOxfmtConfigContent : `${cachedOxfmtConfigContent}\n`;
}
