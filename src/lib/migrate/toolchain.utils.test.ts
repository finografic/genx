import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { applyToolchainChanges, planToolchainChanges } from './toolchain.utils.js';

const TC = { node: '24.3.0', pnpm: '10.32.1' };

describe('planToolchainChanges', () => {
  it('returns all three changes when target has no toolchain state', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-tc-'));
    const pkg = { name: 'x', version: '1.0.0' };
    await writeFile(join(root, 'package.json'), JSON.stringify(pkg, null, 2));

    const changes = await planToolchainChanges(root, pkg, TC);

    expect(changes).toHaveLength(3);
    expect(changes).toContainEqual({ target: '.nvmrc', from: undefined, to: '24.3.0' });
    expect(changes).toContainEqual({ target: 'engines.node', from: undefined, to: '>=24.3.0' });
    expect(changes).toContainEqual({ target: 'packageManager', from: undefined, to: 'pnpm@10.32.1' });

    await rm(root, { recursive: true, force: true });
  });

  it('returns empty when target already matches policy', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-tc-'));
    await writeFile(join(root, '.nvmrc'), '24.3.0\n');
    const pkg = {
      name: 'x',
      version: '1.0.0',
      engines: { node: '>=24.3.0' },
      packageManager: 'pnpm@10.32.1',
    };
    await writeFile(join(root, 'package.json'), JSON.stringify(pkg, null, 2));

    const changes = await planToolchainChanges(root, pkg, TC);
    expect(changes).toHaveLength(0);

    await rm(root, { recursive: true, force: true });
  });

  it('detects outdated .nvmrc and packageManager', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-tc-'));
    await writeFile(join(root, '.nvmrc'), '22.11.0\n');
    const pkg = {
      name: 'x',
      version: '1.0.0',
      engines: { node: '>=24.3.0' },
      packageManager: 'pnpm@9.15.0',
    };
    await writeFile(join(root, 'package.json'), JSON.stringify(pkg, null, 2));

    const changes = await planToolchainChanges(root, pkg, TC);
    expect(changes).toHaveLength(2);
    expect(changes).toContainEqual({ target: '.nvmrc', from: '22.11.0', to: '24.3.0' });
    expect(changes).toContainEqual({ target: 'packageManager', from: 'pnpm@9.15.0', to: 'pnpm@10.32.1' });

    await rm(root, { recursive: true, force: true });
  });
});

describe('applyToolchainChanges', () => {
  it('writes .nvmrc and patches package.json fields', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-tc-'));
    const pkg = { name: 'x', version: '1.0.0' };
    await writeFile(join(root, 'package.json'), JSON.stringify(pkg, null, 2));

    const changes = await planToolchainChanges(root, pkg, TC);
    const updated = await applyToolchainChanges(root, pkg, changes);

    const nvmrc = await readFile(join(root, '.nvmrc'), 'utf8');
    expect(nvmrc).toBe('24.3.0\n');

    const engines = updated['engines'] as Record<string, string>;
    expect(engines['node']).toBe('>=24.3.0');
    expect(updated['packageManager']).toBe('pnpm@10.32.1');

    await rm(root, { recursive: true, force: true });
  });

  it('is idempotent — applying twice produces the same result', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-tc-'));
    const pkg = { name: 'x', version: '1.0.0' };
    await writeFile(join(root, 'package.json'), JSON.stringify(pkg, null, 2));

    const changes1 = await planToolchainChanges(root, pkg, TC);
    const updated1 = await applyToolchainChanges(root, pkg, changes1);

    const changes2 = await planToolchainChanges(root, updated1, TC);
    expect(changes2).toHaveLength(0);

    await rm(root, { recursive: true, force: true });
  });
});
