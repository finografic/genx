import { readFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { getConfigPath } from '@finografic/cli-kit/xdg';
import { z } from 'zod';

import type { ManagedConfig, ManagedTarget } from 'types/managed.types';

import { parseJsoncObject } from './jsonc.utils';

export const GENX_CONFIG_DIR = getConfigPath('genx');
/** File may be JSON or JSONC (line comments, block comments, trailing commas) despite the `.json` name. */
export const GENX_CONFIG_PATH = join(GENX_CONFIG_DIR, 'config.jsonc');

const managedTargetSchema = z.object({
  name: z.string().trim().min(1),
  path: z.string().trim().min(1),
});

const managedConfigSchema = z.object({
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
  const raw = await readFile(GENX_CONFIG_PATH, 'utf8');
  const parsed = managedConfigSchema.parse(parseJsoncObject(raw)) satisfies ManagedConfig;

  return {
    managed: parsed.managed.map((target) =>
      Object.assign(target, { path: isAbsolute(target.path) ? target.path : resolve(target.path) }),
    ),
  };
}

export async function readManagedTargets(): Promise<ManagedTarget[]> {
  const config = await readManagedConfig();
  return config.managed;
}
