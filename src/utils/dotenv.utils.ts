import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { findPackageRoot } from './package-root.utils.js';

/**
 * Values from the genx package's own `.env`, read once on first use.
 *
 * Deliberately NOT `process.loadEnvFile()`: that follows `--env-file` semantics where an
 * already-exported shell variable wins over the file. Here the file wins, so editing
 * `.env` actually changes behavior on a machine whose shell exports the same variable
 * globally (e.g. `OLLAMA_DEFAULT_MODEL` set in ~/.zshrc).
 */
let cached: Map<string, string> | null = null;

/** Minimal `KEY=VALUE` parser — comments, blank lines, `export ` prefixes, and quotes. */
export function parseDotenv(contents: string): Map<string, string> {
  const values = new Map<string, string>();

  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator <= 0) continue;

    const key = line
      .slice(0, separator)
      .replace(/^export\s+/, '')
      .trim();
    if (key === '') continue;

    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^(['"])(.*)\1$/, '$2');

    values.set(key, value);
  }

  return values;
}

function loadDotenv(): Map<string, string> {
  if (cached !== null) return cached;

  // Resolve relative to this module so it works from src/ and dist/ alike, and points at
  // the genx package rather than whatever target directory is being operated on.
  const packageRoot = findPackageRoot(dirname(fileURLToPath(import.meta.url)));
  const envPath = resolve(packageRoot, '.env');

  if (!existsSync(envPath)) {
    cached = new Map();
    return cached;
  }

  try {
    cached = parseDotenv(readFileSync(envPath, 'utf8'));
  } catch {
    cached = new Map();
  }

  return cached;
}

/**
 * Read a config value, preferring genx's `.env` and falling back to the process
 * environment. Returns `undefined` when neither has a non-empty value, so callers
 * can apply their own constant default.
 */
export function readEnvValue(key: string): string | undefined {
  const fromFile = loadDotenv().get(key)?.trim();
  if (fromFile !== undefined && fromFile !== '') return fromFile;

  const fromProcess = process.env[key]?.trim();
  return fromProcess === undefined || fromProcess === '' ? undefined : fromProcess;
}
