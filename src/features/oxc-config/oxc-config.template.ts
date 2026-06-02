import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { inferPackageTypeId } from 'lib/package-type.utils';
import { findPackageRoot } from 'utils/package-root.utils';

import type { PackageJson } from 'types/package-json.types';

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

function getOxlintPresetName(packageJson: PackageJson): string {
  switch (inferPackageTypeId(packageJson)) {
    case 'react':
      return 'oxlintClientConfig';
    case 'cli':
      return 'oxlintCliConfig';
    case 'config':
    case 'library':
    default:
      return 'oxlintLibraryConfig';
  }
}

/** Canonical `oxlint.config.ts` based on inferred package type and shared preset exports. */
export function getOxlintConfigCanonicalFileContent(packageJson: PackageJson): string {
  const presetName = getOxlintPresetName(packageJson);

  return `import { defineConfig } from 'oxlint';
import type { OxlintConfig } from 'oxlint';
import { ${presetName}, testOverrides, configOverrides } from '@finografic/oxc-config/oxlint';

export default defineConfig({
  ...${presetName},
  overrides: [testOverrides, configOverrides],
} satisfies OxlintConfig);
`;
}
