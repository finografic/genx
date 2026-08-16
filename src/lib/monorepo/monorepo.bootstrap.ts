import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Source env template shipped by the starter. */
export const ENV_EXAMPLE_FILE = '.env.example';

/**
 * Target the starter expects — its `.env.example` opens with
 * "Copy to .env.development and fill in values." Not `.env`.
 */
export const ENV_DEVELOPMENT_FILE = '.env.development';

/** Placeholder the starter ships; never leave it in a generated workspace. */
const AUTH_SECRET_PLACEHOLDER = 'change-me-to-a-32-char-random-string';

/** Generate a URL-safe 32-character secret. */
export function generateAuthSecret(): string {
  return randomBytes(24).toString('base64url').slice(0, 32);
}

/**
 * Replace the shipped `AUTH_SECRET` placeholder with a freshly generated value.
 *
 * Exported for testing. Leaves the content untouched when the placeholder is absent, so a starter
 * that stops shipping it does not silently get a mangled env file.
 */
export function applyEnvSecrets(content: string, secret: string): string {
  return content.replace(AUTH_SECRET_PLACEHOLDER, secret);
}

/**
 * Seed `.env.development` from `.env.example`, giving the workspace its own `AUTH_SECRET`.
 *
 * @returns `true` when the file was written, `false` when there was nothing to copy or the target
 *   already exists (never clobber an env file).
 */
export async function seedDevEnvFile(targetDir: string): Promise<boolean> {
  const source = join(targetDir, ENV_EXAMPLE_FILE);
  const destination = join(targetDir, ENV_DEVELOPMENT_FILE);

  if (!existsSync(source) || existsSync(destination)) {
    return false;
  }

  const content = await readFile(source, 'utf8');
  await writeFile(destination, applyEnvSecrets(content, generateAuthSecret()), 'utf8');

  return true;
}
