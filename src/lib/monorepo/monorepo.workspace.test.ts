import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  isMonorepoRoot,
  MONOREPO_WORKSPACE_KEYWORD,
  readWorkspaceMembers,
  readWorkspacePatterns,
  collectWorkspaceManifests,
} from './monorepo.workspace.js';

async function makeRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'genx-ws-'));
}

async function addMember(root: string, relativePath: string, name?: string): Promise<void> {
  const dir = join(root, relativePath);
  await mkdir(dir, { recursive: true });
  if (name !== undefined) {
    await writeFile(join(dir, 'package.json'), `${JSON.stringify({ name }, null, 2)}\n`);
  }
}

const STARTER_YAML = `packages:
  - config
  - packages/*
  - apps/*

allowBuilds:
  better-sqlite3: true
`;

describe('isMonorepoRoot', () => {
  it('is true on the keyword alone', async () => {
    const root = await makeRoot();

    expect(await isMonorepoRoot(root, { keywords: [MONOREPO_WORKSPACE_KEYWORD] })).toBe(true);

    await rm(root, { recursive: true, force: true });
  });

  it('falls back to pnpm-workspace.yaml when the keyword is absent', async () => {
    // Monorepos generated before the marker existed carry no keyword. Treating them as single
    // packages is exactly the failure this detection prevents.
    const root = await makeRoot();
    await writeFile(join(root, 'pnpm-workspace.yaml'), STARTER_YAML);

    expect(await isMonorepoRoot(root, { name: 'x' })).toBe(true);

    await rm(root, { recursive: true, force: true });
  });

  it('is false for a plain package', async () => {
    const root = await makeRoot();

    expect(await isMonorepoRoot(root, { name: 'x', keywords: ['genx:type:library'] })).toBe(false);

    await rm(root, { recursive: true, force: true });
  });

  it('is false when pnpm-workspace.yaml carries only pnpm settings', async () => {
    // Since pnpm 10, single packages keep `allowBuilds` / `minimumReleaseAgeExclude` in this file —
    // genx and cli-kit both do. Treating its mere presence as a workspace made every single-package
    // repo take the workspace path and refuse its own toolchain features.
    const root = await makeRoot();
    await writeFile(
      join(root, 'pnpm-workspace.yaml'),
      "allowBuilds:\n  esbuild: true\nminimumReleaseAgeExclude:\n  - '@finografic/deps-policy@0.26.13'\n",
    );

    expect(await isMonorepoRoot(root, { name: '@finografic/genx' })).toBe(false);

    await rm(root, { recursive: true, force: true });
  });
});

describe('readWorkspacePatterns', () => {
  it('reads the packages globs and ignores the rest of the file', async () => {
    const root = await makeRoot();
    await writeFile(join(root, 'pnpm-workspace.yaml'), STARTER_YAML);

    expect(await readWorkspacePatterns(root)).toEqual(['config', 'packages/*', 'apps/*']);

    await rm(root, { recursive: true, force: true });
  });

  it('returns empty when the file is missing', async () => {
    const root = await makeRoot();

    expect(await readWorkspacePatterns(root)).toEqual([]);

    await rm(root, { recursive: true, force: true });
  });

  it('returns empty rather than throwing on malformed yaml', async () => {
    // Upgrade should stay on the single-package path, not crash mid-run.
    const root = await makeRoot();
    await writeFile(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - [unclosed\n');

    expect(await readWorkspacePatterns(root)).toEqual([]);

    await rm(root, { recursive: true, force: true });
  });

  it('returns empty when packages is not a list', async () => {
    const root = await makeRoot();
    await writeFile(join(root, 'pnpm-workspace.yaml'), 'allowBuilds:\n  esbuild: true\n');

    expect(await readWorkspacePatterns(root)).toEqual([]);

    await rm(root, { recursive: true, force: true });
  });
});

describe('readWorkspaceMembers', () => {
  it('expands globs and sorts by path', async () => {
    const root = await makeRoot();
    await writeFile(join(root, 'pnpm-workspace.yaml'), STARTER_YAML);
    await addMember(root, 'apps/server', '@workspace/server');
    await addMember(root, 'apps/client', '@workspace/client');
    await addMember(root, 'packages/ui', '@workspace/ui');
    await addMember(root, 'config', '@workspace/config');

    const members = await readWorkspaceMembers(root);

    expect(members.map((m) => m.relativePath)).toEqual([
      'apps/client',
      'apps/server',
      'config',
      'packages/ui',
    ]);
    expect(members[0].name).toBe('@workspace/client');
    expect(members[0].dir).toBe(join(root, 'apps/client'));

    await rm(root, { recursive: true, force: true });
  });

  it('skips matched directories that have no package.json', async () => {
    // `apps/*` matches build output and scratch directories just as readily as real packages.
    const root = await makeRoot();
    await writeFile(join(root, 'pnpm-workspace.yaml'), STARTER_YAML);
    await addMember(root, 'apps/client', '@workspace/client');
    await addMember(root, 'apps/scratch');

    const members = await readWorkspaceMembers(root);

    expect(members.map((m) => m.relativePath)).toEqual(['apps/client']);

    await rm(root, { recursive: true, force: true });
  });

  it('honours negated patterns', async () => {
    const root = await makeRoot();
    await writeFile(
      join(root, 'pnpm-workspace.yaml'),
      'packages:\n  - packages/*\n  - "!packages/private-*"\n',
    );
    await addMember(root, 'packages/ui', '@workspace/ui');
    await addMember(root, 'packages/private-secrets', '@workspace/private-secrets');

    const members = await readWorkspaceMembers(root);

    expect(members.map((m) => m.relativePath)).toEqual(['packages/ui']);

    await rm(root, { recursive: true, force: true });
  });

  it('does not descend into node_modules', async () => {
    const root = await makeRoot();
    await writeFile(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - "**"\n');
    await addMember(root, 'packages/ui', '@workspace/ui');
    await addMember(root, 'node_modules/some-dep', 'some-dep');

    const members = await readWorkspaceMembers(root);

    expect(members.every((m) => !m.relativePath.includes('node_modules'))).toBe(true);
    expect(members.map((m) => m.relativePath)).toContain('packages/ui');

    await rm(root, { recursive: true, force: true });
  });

  it('returns empty for a non-workspace directory', async () => {
    const root = await makeRoot();

    expect(await readWorkspaceMembers(root)).toEqual([]);

    await rm(root, { recursive: true, force: true });
  });

  it('keeps a member whose package.json is unparseable', async () => {
    // The directory is still a real member; only its name is unknown.
    const root = await makeRoot();
    await writeFile(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
    await addMember(root, 'packages/broken');
    await writeFile(join(root, 'packages/broken/package.json'), '{ not json');

    const members = await readWorkspaceMembers(root);

    expect(members).toHaveLength(1);
    expect(members[0].relativePath).toBe('packages/broken');
    expect(members[0].name).toBeUndefined();

    await rm(root, { recursive: true, force: true });
  });
});

describe('collectWorkspaceManifests', () => {
  it('returns only the root manifest for a single package', async () => {
    const root = await makeRoot();
    await writeFile(join(root, 'package.json'), '{ "name": "solo" }\n');

    const manifests = await collectWorkspaceManifests(root, { name: 'solo' });

    expect(manifests).toEqual([{ packageJsonPath: join(root, 'package.json'), label: '' }]);

    await rm(root, { recursive: true, force: true });
  });

  // The regression this exists for: policy was applied to the workspace root only, so members
  // drifted while every run reported "already aligned".
  it('includes every workspace member alongside the root', async () => {
    const root = await makeRoot();
    await writeFile(join(root, 'pnpm-workspace.yaml'), STARTER_YAML);
    await addMember(root, 'packages/ui', '@workspace/ui');
    await addMember(root, 'apps/client', '@workspace/client');

    const manifests = await collectWorkspaceManifests(root, {});

    expect(manifests.map((manifest) => manifest.label)).toEqual(['', 'apps/client', 'packages/ui']);
    expect(manifests[2].packageJsonPath).toBe(join(root, 'packages/ui', 'package.json'));

    await rm(root, { recursive: true, force: true });
  });

  it('skips a matched directory that has no package.json', async () => {
    const root = await makeRoot();
    await writeFile(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
    await addMember(root, 'packages/real', '@workspace/real');
    await addMember(root, 'packages/empty');

    const manifests = await collectWorkspaceManifests(root, {});

    expect(manifests.map((manifest) => manifest.label)).toEqual(['', 'packages/real']);

    await rm(root, { recursive: true, force: true });
  });
});
