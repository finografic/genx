import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { fileExists } from 'utils/fs.utils';

const DPRINT_CONFIG_FILENAME = 'dprint.jsonc';

export interface EnsureDprintConfigOptions {
  force?: boolean;
}

/**
 * Ensure a minimal `dprint.jsonc` exists in the target directory that extends
 * `@finografic/dprint-config`.
 *
 * This is intentionally generated (not stored in templates/) so that running
 * `dprint check` in this repo doesn't try to resolve `node_modules/...` inside
 * `templates/`.
 */
export async function ensureDprintConfig(
  targetDir: string,
  options: EnsureDprintConfigOptions = {},
): Promise<{ wrote: boolean; path: string }> {
  const path = join(targetDir, DPRINT_CONFIG_FILENAME);

  if (!options.force && fileExists(path)) {
    return { wrote: false, path };
  }

  const contents = `{
  "$schema": "https://dprint.dev/schemas/v0.json",
  "extends": "node_modules/@finografic/dprint-config/dprint.jsonc"
}
`;

  await writeFile(path, contents, 'utf8');
  return { wrote: true, path };
}
