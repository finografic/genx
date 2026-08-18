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

  it('aligns engines.pnpm when the target declares it', async () => {
    // The deps-xscan failure: engines.pnpm left at 10.x while packageManager moved to pnpm 11.
    // pnpm obeys packageManager, so every install failed the package's own engine check.
    const root = await mkdtemp(join(tmpdir(), 'genx-tc-'));
    await writeFile(join(root, '.nvmrc'), `${TC.node}\n`);
    const pkg = {
      name: 'x',
      version: '1.0.0',
      engines: { node: `>=${TC.node}`, pnpm: '9.x' },
      packageManager: `pnpm@${TC.pnpm}`,
    };
    await writeFile(join(root, 'package.json'), JSON.stringify(pkg, null, 2));

    const changes = await planToolchainChanges(root, pkg, TC);

    expect(changes).toEqual([{ target: 'engines.pnpm', from: '9.x', to: `>=${TC.pnpm}` }]);

    await rm(root, { recursive: true, force: true });
  });

  it('does not add engines.pnpm to a target that has none', async () => {
    // Adding a floor nobody declared would impose a constraint the project never chose.
    const root = await mkdtemp(join(tmpdir(), 'genx-tc-'));
    await writeFile(join(root, '.nvmrc'), `${TC.node}\n`);
    const pkg = {
      name: 'x',
      version: '1.0.0',
      engines: { node: `>=${TC.node}` },
      packageManager: `pnpm@${TC.pnpm}`,
    };
    await writeFile(join(root, 'package.json'), JSON.stringify(pkg, null, 2));

    const changes = await planToolchainChanges(root, pkg, TC);

    expect(changes).toEqual([]);

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

  it('writes engines.pnpm without disturbing engines.node', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-tc-'));
    const pkg = {
      name: 'x',
      version: '1.0.0',
      engines: { node: '>=20.0.0', pnpm: '9.x' },
      packageManager: 'pnpm@9.15.0',
    };
    await writeFile(join(root, 'package.json'), JSON.stringify(pkg, null, 2));

    const changes = await planToolchainChanges(root, pkg, TC);
    const updated = await applyToolchainChanges(root, pkg, changes);

    const engines = updated['engines'] as Record<string, string>;
    expect(engines['pnpm']).toBe(`>=${TC.pnpm}`);
    expect(engines['node']).toBe(`>=${TC.node}`);
    expect(updated['packageManager']).toBe(`pnpm@${TC.pnpm}`);

    // The pairing that failed in the wild: engines.pnpm must not contradict packageManager.
    expect(engines['pnpm']).toBe(`>=${TC.pnpm}`);
    expect(updated['packageManager']).toBe(`pnpm@${TC.pnpm}`);

    await rm(root, { recursive: true, force: true });
  });
});
