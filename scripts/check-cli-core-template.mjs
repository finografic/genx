/**
 * Ensures the packaged template snapshot matches the canonical spec in-repo.
 * After editing docs/spec/CLI_CORE.md, copy it to _templates/docs/spec/CLI_CORE.md
 * (or run a one-line cp) so create/migrate stay aligned.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const canonical = readFileSync(resolve(root, 'docs/spec/CLI_CORE.md'), 'utf8');
const template = readFileSync(resolve(root, '_templates/docs/spec/CLI_CORE.md'), 'utf8');

if (canonical !== template) {
  console.error(
    'Mismatch: docs/spec/CLI_CORE.md and _templates/docs/spec/CLI_CORE.md must be identical.\n' +
      'Copy the canonical file into _templates/docs/spec/ after editing the spec.',
  );
  process.exit(1);
}
