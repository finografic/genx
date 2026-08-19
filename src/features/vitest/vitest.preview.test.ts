import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { PackageJson } from 'types/package-json.types';

import { previewVitest } from './vitest.preview.js';

async function createTarget(packageJson: PackageJson, files: string[] = []): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'genx-vitest-'));
  await writeFile(join(root, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
  for (const file of files) {
    await writeFile(join(root, file), '// fixture\n');
  }
  return root;
}

function configContent(preview: Awaited<ReturnType<typeof previewVitest>>): string {
  const change = preview.changes.find((c) => c.kind === 'write' && c.path.endsWith('vitest.config.ts'));
  if (change?.kind !== 'write') throw new Error('no vitest.config.ts change proposed');
  return change.proposedContent;
}

function proposedPackageJson(preview: Awaited<ReturnType<typeof previewVitest>>): PackageJson {
  const change = preview.changes.find((c) => c.kind === 'write' && c.path.endsWith('package.json'));
  if (change?.kind !== 'write') throw new Error('no package.json change proposed');
  return JSON.parse(change.proposedContent) as PackageJson;
}

describe('vitest preview — config template selection', () => {
  it('uses the react template for a frontend package that has a vite config', async () => {
    const root = await createTarget(
      {
        name: 'client',
        version: '1.0.0',
        dependencies: { react: '^19.2.0' },
        devDependencies: { vite: '^7.1.10' },
      },
      ['vite.config.ts'],
    );

    const preview = await previewVitest({ targetDir: root });

    // The react template merges the package's vite config so tests inherit its aliases/plugins.
    expect(configContent(preview)).toContain('mergeConfig');
    expect(configContent(preview)).toContain("environment: 'happy-dom'");
    expect(proposedPackageJson(preview).devDependencies).toHaveProperty('happy-dom');

    await rm(root, { recursive: true, force: true });
  });

  it('falls back to the base template for a frontend package with no vite config', async () => {
    // A component library is react-shaped but has no vite.config to merge — the react template
    // imports './vite.config', so using it here would write a config that cannot resolve.
    const root = await createTarget({
      name: 'ui',
      version: '1.0.0',
      keywords: ['genx:type:react'],
      dependencies: { react: '^19.2.0' },
    });

    const preview = await previewVitest({ targetDir: root });

    expect(configContent(preview)).not.toContain('mergeConfig');
    expect(configContent(preview)).toContain("environment: 'node'");
    expect(proposedPackageJson(preview).devDependencies).not.toHaveProperty('happy-dom');

    await rm(root, { recursive: true, force: true });
  });

  it('uses the base template for a non-frontend package', async () => {
    const root = await createTarget({ name: 'server', version: '1.0.0' }, ['vite.config.ts']);

    const preview = await previewVitest({ targetDir: root });

    expect(configContent(preview)).not.toContain('mergeConfig');
    expect(proposedPackageJson(preview).devDependencies).not.toHaveProperty('happy-dom');

    await rm(root, { recursive: true, force: true });
  });
});
