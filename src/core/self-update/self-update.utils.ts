import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPnpm } from '@finografic/cli-kit/package-manager';
import { createXdgPaths } from '@finografic/cli-kit/xdg';
import * as clack from '@clack/prompts';
import { execa } from 'execa';
import pc from 'picocolors';
import type { UpdateCache } from './self-update.types.js';

import { findPackageRoot } from 'utils/package-root.utils.js';

const xdg = createXdgPaths();

const DEPS_POLICY_PKG = '@finografic/deps-policy';
const DEPS_POLICY_REGISTRY = 'https://npm.pkg.github.com';
const UPDATE_CACHE_PATH = xdg.cachePath('genx');
const CHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

function getGenxRoot(): string {
  const __filename = fileURLToPath(import.meta.url);
  return findPackageRoot(dirname(__filename));
}

async function readCache(): Promise<UpdateCache | null> {
  try {
    const raw = await readFile(UPDATE_CACHE_PATH, 'utf8');
    return JSON.parse(raw) as UpdateCache;
  } catch {
    return null;
  }
}

async function writeCache(cache: UpdateCache): Promise<void> {
  await mkdir(dirname(UPDATE_CACHE_PATH), { recursive: true });
  await writeFile(UPDATE_CACHE_PATH, JSON.stringify(cache, null, 2) + '\n', 'utf8');
}

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const result = await execa(
      'pnpm',
      ['view', DEPS_POLICY_PKG, 'version', '--registry', DEPS_POLICY_REGISTRY],
      { reject: false },
    );
    const version = result.stdout.trim();
    return version || null;
  } catch {
    return null;
  }
}

async function getInstalledVersion(genxRoot: string): Promise<string | null> {
  try {
    const pkgPath = resolve(genxRoot, 'node_modules/@finografic/deps-policy/package.json');
    const raw = await readFile(pkgPath, 'utf8');
    const pkg = JSON.parse(raw) as { version: string };
    return pkg.version;
  } catch {
    return null;
  }
}

async function applyUpdate(genxRoot: string, latestVersion: string): Promise<void> {
  const code = await runPnpm(genxRoot, ['update', DEPS_POLICY_PKG, '--latest']);

  if (code !== 0) {
    clack.log.error(
      `Update failed (exit ${code ?? 'unknown'}). Run manually:\n  pnpm update ${DEPS_POLICY_PKG} --latest`,
    );
    return;
  }

  clack.log.success(
    `${pc.bold(DEPS_POLICY_PKG)} updated to ${pc.green(latestVersion)} — re-run genx to continue.`,
  );
  process.exit(0);
}

/**
 * Runs on every genx startup. Silently skips if the cache is still fresh. When the check interval has
 * elapsed, hits the registry and prompts if an update is available.
 */
export async function runSelfUpdateCheck(): Promise<void> {
  const cache = await readCache();

  const isStale =
    !cache?.lastChecked || Date.now() - new Date(cache.lastChecked).getTime() > CHECK_INTERVAL_MS;

  if (!isStale) return;

  const latestVersion = await fetchLatestVersion();

  await writeCache({
    lastChecked: new Date().toISOString(),
    latestVersion: latestVersion ?? cache?.latestVersion ?? '',
  });

  if (!latestVersion) return;

  const genxRoot = getGenxRoot();
  const installedVersion = await getInstalledVersion(genxRoot);

  if (!installedVersion || installedVersion === latestVersion) return;

  clack.log.info(
    `${pc.bold(DEPS_POLICY_PKG)} update available: ${pc.dim(installedVersion)} → ${pc.green(latestVersion)}`,
  );

  const shouldUpdate = await clack.confirm({
    message: `Update ${pc.bold(DEPS_POLICY_PKG)} in genx now?`,
    initialValue: true,
  });

  if (clack.isCancel(shouldUpdate) || !shouldUpdate) return;

  await applyUpdate(genxRoot, latestVersion);
}

/**
 * Explicit `genx update-self` command. Bypasses the cache and always checks the registry, showing current vs
 * latest.
 */
export async function runSelfUpdateForced(): Promise<void> {
  const spin = clack.spinner();
  spin.start(`Checking ${DEPS_POLICY_PKG}…`);

  const genxRoot = getGenxRoot();
  const [installedVersion, latestVersion] = await Promise.all([
    getInstalledVersion(genxRoot),
    fetchLatestVersion(),
  ]);

  if (!latestVersion) {
    spin.stop('Could not reach registry — check your network or auth.');
    return;
  }

  if (!installedVersion || installedVersion === latestVersion) {
    spin.stop(`${pc.bold(DEPS_POLICY_PKG)} is up to date (${pc.green(latestVersion)})`);

    await writeCache({
      lastChecked: new Date().toISOString(),
      latestVersion,
    });
    return;
  }

  spin.stop(`${pc.bold(DEPS_POLICY_PKG)}: ${pc.dim(installedVersion)} → ${pc.green(latestVersion)}`);

  const shouldUpdate = await clack.confirm({
    message: 'Update now?',
    initialValue: true,
  });

  if (clack.isCancel(shouldUpdate) || !shouldUpdate) {
    clack.cancel('Skipped.');
    return;
  }

  await applyUpdate(genxRoot, latestVersion);
}
