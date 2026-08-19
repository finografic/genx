import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MonorepoIdentity } from './monorepo.identity';

import {
  applyMonorepoIdentity,
  buildMonorepoReadme,
  resetProjectMemory,
  rewriteRootPackageJson,
} from './monorepo.identity';

const identity: MonorepoIdentity = {
  scope: '@finografic',
  name: 'my-app',
  description: 'A new full-stack workspace',
  author: { name: 'Justin Rankin', email: 'justin@example.com', url: 'https://example.com' },
};

const toolchain = { node: '24.16.0', pnpm: '11.21.0' };

/**
 * The starter's root package.json _fields_ — not its current values.
 *
 * `engines`, `packageManager`, `version` and the `starter` keyword are deliberately stale here so
 * the assertions prove the transform overwrote them. A fixture already matching policy would pass
 * even if `rewriteRootPackageJson` never touched those fields.
 */
const STARTER_PACKAGE_JSON = {
  name: '@finografic/monorepo-starter',
  version: '0.1.0',
  private: true,
  description: 'Full-stack pnpm monorepo starter',
  keywords: ['finografic', 'monorepo', 'pnpm', 'starter', 'turborepo', 'typescript'],
  homepage: 'https://github.com/finografic/monorepo-starter',
  bugs: { url: 'https://github.com/finografic/monorepo-starter/issues' },
  repository: { type: 'git', url: 'git+https://github.com/finografic/monorepo-starter.git' },
  scripts: { dev: 'turbo run dev', build: 'turbo run build' },
  devDependencies: { turbo: '^2.8.16' },
  engines: { node: '>=20.0.0', pnpm: '>=9.0.0' },
  packageManager: 'pnpm@9.0.0',
};

let targetDir: string;
let templateDir: string;

beforeEach(async () => {
  const root = await mkdtemp(join(tmpdir(), 'genx-monorepo-'));
  targetDir = join(root, 'target');
  templateDir = join(root, 'templates');

  await mkdir(join(targetDir, '.agents'), { recursive: true });
  await mkdir(join(targetDir, 'docs/todo'), { recursive: true });
  await mkdir(join(templateDir, '.agents'), { recursive: true });
  await mkdir(join(templateDir, 'docs/todo'), { recursive: true });

  await writeFile(
    join(targetDir, 'package.json'),
    `${JSON.stringify(STARTER_PACKAGE_JSON, null, 2)}\n`,
    'utf8',
  );
  await writeFile(join(targetDir, '.agents/handoff.md'), 'starter handoff', 'utf8');
  await writeFile(join(targetDir, '.agents/memory.md'), 'starter memory', 'utf8');
  await writeFile(join(targetDir, 'docs/todo/ROADMAP.md'), 'starter roadmap', 'utf8');
  await writeFile(join(targetDir, 'docs/todo/TODO_PHASE_01.md'), 'starter phase', 'utf8');
  await writeFile(join(targetDir, 'docs/todo/DONE_SOMETHING.md'), 'starter done', 'utf8');
  await writeFile(join(targetDir, 'docs/todo/NOTES.md'), 'keep me', 'utf8');

  await writeFile(join(templateDir, '.agents/handoff.md'), 'template handoff', 'utf8');
  await writeFile(join(templateDir, '.agents/memory.md'), 'template memory', 'utf8');
  await writeFile(join(templateDir, 'docs/todo/ROADMAP.md'), 'template roadmap', 'utf8');
});

afterEach(async () => {
  await rm(join(targetDir, '..'), { recursive: true, force: true });
});

async function readTargetPackageJson(): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(join(targetDir, 'package.json'), 'utf8')) as Record<string, unknown>;
}

describe('rewriteRootPackageJson', () => {
  it('rewrites identity fields and drops the starter-only keyword', async () => {
    await rewriteRootPackageJson(targetDir, identity, toolchain);
    const pkg = await readTargetPackageJson();

    expect(pkg['name']).toBe('@finografic/my-app');
    expect(pkg['version']).toBe('0.1.0');
    expect(pkg['description']).toBe('A new full-stack workspace');
    expect(pkg['keywords']).not.toContain('starter');
    expect(pkg['keywords']).toContain('monorepo');
    // The marker `upgrade` reads to route a workspace root away from the single-package path.
    expect(pkg['keywords']).toContain('genx:workspace:monorepo');
    expect(pkg['homepage']).toBe('https://github.com/finografic/my-app');
    expect(pkg['bugs']).toEqual({ url: 'https://github.com/finografic/my-app/issues' });
    expect(pkg['repository']).toEqual({
      type: 'git',
      url: 'git+https://github.com/finografic/my-app.git',
    });
    expect(pkg['author']).toEqual({
      name: 'Justin Rankin',
      email: 'justin@example.com',
      url: 'https://example.com',
    });
  });

  it('preserves the starter working configuration', async () => {
    await rewriteRootPackageJson(targetDir, identity, toolchain);
    const pkg = await readTargetPackageJson();

    expect(pkg['private']).toBe(true);
    expect(pkg['scripts']).toEqual(STARTER_PACKAGE_JSON.scripts);
    expect(pkg['devDependencies']).toEqual(STARTER_PACKAGE_JSON.devDependencies);
  });

  it('applies policy toolchain versions to package.json and .nvmrc', async () => {
    await rewriteRootPackageJson(targetDir, identity, toolchain);
    const pkg = await readTargetPackageJson();

    expect(pkg['engines']).toEqual({ node: '>=24.16.0', pnpm: '>=11.21.0' });
    expect(pkg['packageManager']).toBe('pnpm@11.21.0');
    expect(await readFile(join(targetDir, '.nvmrc'), 'utf8')).toBe('24.16.0\n');
  });

  it('accepts a scope without a leading @', async () => {
    await rewriteRootPackageJson(targetDir, { ...identity, scope: 'finografic' }, toolchain);
    const pkg = await readTargetPackageJson();

    expect(pkg['name']).toBe('@finografic/my-app');
  });

  it('omits author.url when blank', async () => {
    await rewriteRootPackageJson(
      targetDir,
      { ...identity, author: { ...identity.author, url: '' } },
      toolchain,
    );
    const pkg = await readTargetPackageJson();

    expect(pkg['author']).toEqual({ name: 'Justin Rankin', email: 'justin@example.com' });
  });
});

describe('buildMonorepoReadme', () => {
  it('titles the readme with the scoped package name and keeps the @workspace scope', () => {
    const readme = buildMonorepoReadme(identity);

    expect(readme).toContain('# @finografic/my-app');
    expect(readme).toContain('A new full-stack workspace');
    expect(readme).toContain('@workspace/client');
    expect(readme).toContain('MIT © [Justin Rankin](https://example.com)');
  });

  it('documents the env target the starter actually expects', () => {
    const readme = buildMonorepoReadme(identity);

    // The starter's .env.example says "Copy to .env.development" — not `.env`.
    expect(readme).toContain('cp .env.example .env.development');
    expect(readme).toContain('pnpm dev:db:reset');
    expect(readme).not.toMatch(/cp \.env\.example \.env$/m);
  });

  it('renders the author without a link when no url is given', () => {
    const readme = buildMonorepoReadme({ ...identity, author: { ...identity.author, url: '' } });

    expect(readme).toContain('MIT © Justin Rankin');
    expect(readme).not.toContain('MIT © [Justin Rankin]');
  });
});

describe('resetProjectMemory', () => {
  it('replaces project memory and removes starter build history', async () => {
    await resetProjectMemory(targetDir, templateDir, ['TODO_', 'DONE_']);

    expect(await readFile(join(targetDir, '.agents/handoff.md'), 'utf8')).toBe('template handoff');
    expect(await readFile(join(targetDir, '.agents/memory.md'), 'utf8')).toBe('template memory');
    expect(await readFile(join(targetDir, 'docs/todo/ROADMAP.md'), 'utf8')).toBe('template roadmap');

    const remaining = await readdir(join(targetDir, 'docs/todo'));
    expect(remaining.toSorted()).toEqual(['NOTES.md', 'ROADMAP.md']);
  });
});

describe('applyMonorepoIdentity', () => {
  it('applies every transform and reports the rewritten paths', async () => {
    const touched = await applyMonorepoIdentity({
      targetDir,
      templateDir,
      identity,
      toolchain,
      docsTodoResetPrefixes: ['TODO_', 'DONE_'],
    });

    const pkg = await readTargetPackageJson();
    expect(pkg['name']).toBe('@finografic/my-app');
    expect(await readFile(join(targetDir, 'README.md'), 'utf8')).toContain('# @finografic/my-app');
    expect(await readFile(join(targetDir, '.agents/handoff.md'), 'utf8')).toBe('template handoff');
    expect(touched).toContain('package.json');
    expect(touched).toContain('README.md');
  });
});
