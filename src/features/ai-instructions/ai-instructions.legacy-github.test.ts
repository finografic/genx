import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { applyAiInstructions } from './ai-instructions.apply.js';

const CUSTOM = '---\napplyTo: "**"\n---\n\n# House rules for THIS project only\n';

/**
 * Retiring `.github/instructions/` on a repository migrating for the first time.
 *
 * Exercised through `applyAiInstructions` rather than the collector alone: the fault this covers was
 * in the *wiring*, not the logic. The collector was guarded on the canonical directory existing on
 * disk, which during a preview it does not yet — so the retirement silently did nothing in exactly
 * the case it exists for, while its unit tests passed.
 */
async function createLegacyTarget(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'genx-legacy-gh-'));
  await writeFile(
    join(root, 'package.json'),
    `${JSON.stringify({ name: 'x', version: '1.0.0' }, null, 2)}\n`,
  );

  await mkdir(join(root, '.github/instructions/project'), { recursive: true });
  await mkdir(join(root, '.github/instructions/code'), { recursive: true });
  await writeFile(join(root, '.github/instructions/project/house.instructions.md'), CUSTOM);
  await writeFile(join(root, '.github/instructions/project/.gitkeep'), '');
  await writeFile(join(root, '.github/instructions/.DS_Store'), 'junk');
  await writeFile(join(root, '.github/instructions/code/typescript-patterns.instructions.md'), 'STALE\n');

  await writeFile(
    join(root, 'AGENTS.md'),
    '# AGENTS.md\n\n## Rules — Global\n\nRules are canonical in `.github/instructions/`.\n\n- TypeScript: `.github/instructions/code/typescript-patterns.instructions.md`\n',
  );

  return root;
}

describe('retiring .github/instructions on a first migration', () => {
  it('moves project-specific rules instead of losing them', async () => {
    // Nothing under `project/` is shipped by the shared config — it is the target's own work.
    const root = await createLegacyTarget();

    await applyAiInstructions({ targetDir: root, yesAll: true });

    const moved = join(root, '.agents/instructions/project/house.instructions.md');
    expect(existsSync(moved)).toBe(true);
    await expect(readFile(moved, 'utf8')).resolves.toBe(CUSTOM);

    await rm(root, { recursive: true, force: true });
  });

  it('does not let a stale legacy copy overwrite the canonical instruction', async () => {
    // The canonical tree is only *proposed* at this point, so treating disk state as the whole
    // truth would classify every shipped file as project-specific and copy the stale one over it.
    const root = await createLegacyTarget();

    await applyAiInstructions({ targetDir: root, yesAll: true });

    const canonical = join(root, '.agents/instructions/code/typescript-patterns.instructions.md');
    expect(existsSync(canonical)).toBe(true);
    await expect(readFile(canonical, 'utf8')).resolves.not.toBe('STALE\n');

    await rm(root, { recursive: true, force: true });
  });

  it('removes the legacy directory rather than leaving an empty shell', async () => {
    const root = await createLegacyTarget();

    await applyAiInstructions({ targetDir: root, yesAll: true });

    expect(existsSync(join(root, '.github/instructions'))).toBe(false);

    await rm(root, { recursive: true, force: true });
  });

  it('repoints AGENTS.md at the canonical directory', async () => {
    const root = await createLegacyTarget();

    await applyAiInstructions({ targetDir: root, yesAll: true });

    const agents = await readFile(join(root, 'AGENTS.md'), 'utf8');
    expect(agents).not.toContain('.github/instructions');
    expect(agents).toContain('.agents/instructions/');

    await rm(root, { recursive: true, force: true });
  });
});
