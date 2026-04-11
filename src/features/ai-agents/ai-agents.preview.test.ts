import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { hasPreviewChanges } from '../../lib/feature-preview/feature-preview.utils.js';
import { detectAiAgents } from './ai-agents.detect.js';
import { previewAiAgents } from './ai-agents.preview.js';

describe('ai-agents preview-driven detect', () => {
  it('proposes work when AGENTS.md is missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-agents-'));
    await writeFile(
      join(root, 'package.json'),
      `${JSON.stringify({ name: 'x', version: '1.0.0' }, null, 2)}\n`,
    );

    const preview = await previewAiAgents({ targetDir: root });
    expect(hasPreviewChanges(preview)).toBe(true);
    expect(preview.changes.some((c) => c.kind === 'write' && c.path.endsWith('AGENTS.md'))).toBe(true);
    expect(await detectAiAgents({ targetDir: root })).toBe(false);

    await rm(root, { recursive: true, force: true });
  });

  it('detects no drift when AGENTS.md matches the template and skill dirs exist', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-agents-'));
    await writeFile(
      join(root, 'package.json'),
      `${JSON.stringify({ name: 'x', version: '1.0.0' }, null, 2)}\n`,
    );

    const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
    const templateAgents = join(repoRoot, '_templates/AGENTS.md.template');
    await writeFile(join(root, 'AGENTS.md'), await readFile(templateAgents, 'utf8'));

    const skillsTpl = join(repoRoot, '_templates/.github/skills');
    const skillsDest = join(root, '.github/skills');
    await mkdir(skillsDest, { recursive: true });
    for (const ent of await readdir(skillsTpl, { withFileTypes: true })) {
      if (ent.isDirectory()) {
        await mkdir(join(skillsDest, ent.name), { recursive: true });
      }
    }

    const preview = await previewAiAgents({ targetDir: root });
    expect(hasPreviewChanges(preview)).toBe(false);
    expect(await detectAiAgents({ targetDir: root })).toBe(true);

    await rm(root, { recursive: true, force: true });
  });
});
