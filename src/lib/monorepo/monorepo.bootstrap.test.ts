import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  applyEnvSecrets,
  ENV_DEVELOPMENT_FILE,
  ENV_EXAMPLE_FILE,
  generateAuthSecret,
  seedDevEnvFile,
} from './monorepo.bootstrap';

/** Mirrors the shape of the starter's .env.example. */
const ENV_EXAMPLE = `# Copy to .env.development and fill in values.

API_PORT=4040
DB_NAME=development.sqlite.db
AUTH_SECRET=change-me-to-a-32-char-random-string
AUTH_URL=http://localhost:4040
`;

let targetDir: string;

beforeEach(async () => {
  targetDir = await mkdtemp(join(tmpdir(), 'genx-bootstrap-'));
});

afterEach(async () => {
  await rm(targetDir, { recursive: true, force: true });
});

describe('generateAuthSecret', () => {
  it('produces a 32-character url-safe secret', () => {
    const secret = generateAuthSecret();

    expect(secret).toHaveLength(32);
    expect(secret).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it('does not repeat across calls', () => {
    const secrets = new Set(Array.from({ length: 20 }, () => generateAuthSecret()));

    expect(secrets.size).toBe(20);
  });
});

describe('applyEnvSecrets', () => {
  it('replaces the shipped placeholder', () => {
    const result = applyEnvSecrets(ENV_EXAMPLE, 'x'.repeat(32));

    expect(result).toContain(`AUTH_SECRET=${'x'.repeat(32)}`);
    expect(result).not.toContain('change-me-to-a-32-char-random-string');
  });

  it('leaves other keys untouched', () => {
    const result = applyEnvSecrets(ENV_EXAMPLE, 'x'.repeat(32));

    expect(result).toContain('API_PORT=4040');
    expect(result).toContain('DB_NAME=development.sqlite.db');
    expect(result).toContain('AUTH_URL=http://localhost:4040');
  });

  it('returns content unchanged when the placeholder is absent', () => {
    const content = 'API_PORT=4040\nAUTH_SECRET=already-set\n';

    expect(applyEnvSecrets(content, 'x'.repeat(32))).toBe(content);
  });
});

describe('seedDevEnvFile', () => {
  it('writes .env.development with a generated secret', async () => {
    await writeFile(join(targetDir, ENV_EXAMPLE_FILE), ENV_EXAMPLE, 'utf8');

    await expect(seedDevEnvFile(targetDir)).resolves.toBe(true);

    const written = await readFile(join(targetDir, ENV_DEVELOPMENT_FILE), 'utf8');
    expect(written).not.toContain('change-me-to-a-32-char-random-string');
    expect(written).toMatch(/^AUTH_SECRET=[A-Za-z0-9_-]{32}$/m);
    expect(written).toContain('API_PORT=4040');
  });

  it('gives two workspaces different secrets', async () => {
    await writeFile(join(targetDir, ENV_EXAMPLE_FILE), ENV_EXAMPLE, 'utf8');
    await seedDevEnvFile(targetDir);
    const first = await readFile(join(targetDir, ENV_DEVELOPMENT_FILE), 'utf8');

    const secondDir = await mkdtemp(join(tmpdir(), 'genx-bootstrap-'));
    await writeFile(join(secondDir, ENV_EXAMPLE_FILE), ENV_EXAMPLE, 'utf8');
    await seedDevEnvFile(secondDir);
    const second = await readFile(join(secondDir, ENV_DEVELOPMENT_FILE), 'utf8');
    await rm(secondDir, { recursive: true, force: true });

    expect(first).not.toBe(second);
  });

  it('returns false when there is no .env.example', async () => {
    await expect(seedDevEnvFile(targetDir)).resolves.toBe(false);
  });

  it('never clobbers an existing .env.development', async () => {
    await writeFile(join(targetDir, ENV_EXAMPLE_FILE), ENV_EXAMPLE, 'utf8');
    await writeFile(join(targetDir, ENV_DEVELOPMENT_FILE), 'AUTH_SECRET=mine\n', 'utf8');

    await expect(seedDevEnvFile(targetDir)).resolves.toBe(false);
    expect(await readFile(join(targetDir, ENV_DEVELOPMENT_FILE), 'utf8')).toBe('AUTH_SECRET=mine\n');
  });
});
