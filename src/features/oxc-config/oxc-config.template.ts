import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { inferPackageTypeId, isFrontendPackageType } from 'lib/package-type.utils';
import { findPackageRoot } from 'utils/package-root.utils';

import type { PackageJson } from 'types/package-json.types';

const cachedOxfmtConfigContent = new Map<string, string>();

/**
 * Canonical `oxfmt.config.ts` from `_templates/` (single source of truth).
 *
 * Frontend packages read the react overlay, which carries the `*.css` / `*.scss` override. The base
 * template has none — writing it to a frontend package stripped that project's CSS formatting rules
 * with no replacement, because one template was doing duty for every package type.
 */
export function getOxfmtConfigCanonicalFileContent(packageJson?: PackageJson): string {
  const relativePath =
    packageJson && isFrontendPackageType(inferPackageTypeId(packageJson))
      ? '_templates/package-types/react/oxfmt.config.ts'
      : '_templates/oxfmt.config.ts';

  let content = cachedOxfmtConfigContent.get(relativePath);
  if (content === undefined) {
    const fromDir = fileURLToPath(new URL('.', import.meta.url));
    const pkgRoot = findPackageRoot(fromDir);
    content = readFileSync(join(pkgRoot, relativePath), 'utf8');
    cachedOxfmtConfigContent.set(relativePath, content);
  }

  return content.endsWith('\n') ? content : `${content}\n`;
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
