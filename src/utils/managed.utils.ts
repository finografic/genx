import { readFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { createXdgPaths, parseJsoncObject } from '@finografic/cli-kit/xdg';
import { z } from 'zod';

import type { ManagedConfig, ManagedTarget } from 'types/managed.types';

const xdg = createXdgPaths();

// JSONC extension — file may contain comments and trailing commas
export const GENX_CONFIG_PATH = join(xdg.configDir(), 'genx.config.jsonc');
// ~/.config/finografic/genx.config.jsonc

/** Legacy path — kept so we can emit a one-time migration notice if needed. */
export const GENX_CONFIG_PATH_LEGACY = join(
  xdg.configDir().replace(/\/finografic$/, '/genx'),
  'config.jsonc',
);

const managedTargetSchema = z.object({
  name: z.string().trim().min(1),
  path: z.string().trim().min(1),
});

const managedConfigSchema = z.object({
  depsPolicyPath: z.string().trim().min(1).optional(),
  managed: z.array(managedTargetSchema),
});

export function hasManagedFlag(argv: string[]): boolean {
  return argv.includes('--managed');
}

export function isYesMode(argv: string[]): boolean {
  return argv.includes('--yes') || argv.includes('-y');
}

export function getPathArg(argv: string[]): string | undefined {
  return argv.find((arg) => !arg.startsWith('-'));
}

export function resolveTargetDir(cwd: string, pathArg?: string): string {
  return pathArg ? resolve(cwd, pathArg) : cwd;
}

export async function readManagedConfig(): Promise<ManagedConfig> {
  let raw: string;
  try {
    raw = await readFile(GENX_CONFIG_PATH, 'utf8');
  } catch {
    // One-time migration: fall back to the old ~/.config/genx/config.jsonc location
    raw = await readFile(GENX_CONFIG_PATH_LEGACY, 'utf8');
    console.warn(`[genx] Config found at legacy path. Move it to: ${GENX_CONFIG_PATH}`);
  }
  const parsed = managedConfigSchema.parse(parseJsoncObject(raw)) satisfies ManagedConfig;

  return {
    depsPolicyPath: parsed.depsPolicyPath,
    managed: parsed.managed.map((target) =>
      Object.assign(target, { path: isAbsolute(target.path) ? target.path : resolve(target.path) }),
    ),
  };
}

export async function readManagedTargets(): Promise<ManagedTarget[]> {
  const config = await readManagedConfig();
  return config.managed;
}

/** Returns the local deps-policy repo path from config, or null if not set. */
export async function readDepsPolicyPath(): Promise<string | null> {
  try {
    const config = await readManagedConfig();
    return config.depsPolicyPath ?? null;
  } catch {
    return null;
  }
}
