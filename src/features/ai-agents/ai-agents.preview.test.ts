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

  it('only installs maintain-agents for non-cli packages', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-agents-library-'));
    await writeFile(
      join(root, 'package.json'),
      `${JSON.stringify({ name: 'x', version: '1.0.0', keywords: ['genx:type:library'] }, null, 2)}\n`,
    );

    const preview = await previewAiAgents({ targetDir: root });
    const changedPaths = preview.changes.map((change) => change.path);

    expect(changedPaths.some((path) => path.includes('.github/skills/maintain-agents/'))).toBe(true);
    expect(changedPaths.some((path) => path.includes('.github/skills/scaffold-cli-help/'))).toBe(false);
    expect(changedPaths.some((path) => path.includes('.github/skills/scaffold-core-module/'))).toBe(false);
    expect(changedPaths.some((path) => path.includes('.github/skills/scaffold-feature/'))).toBe(false);

    await rm(root, { recursive: true, force: true });
  });

  it('installs cli-only skills for cli packages', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-agents-cli-'));
    await writeFile(
      join(root, 'package.json'),
      `${JSON.stringify({ name: 'x', version: '1.0.0', keywords: ['genx:type:cli'] }, null, 2)}\n`,
    );

    const preview = await previewAiAgents({ targetDir: root });
    const changedPaths = preview.changes.map((change) => change.path);

    expect(changedPaths.some((path) => path.includes('.github/skills/maintain-agents/'))).toBe(true);
    expect(changedPaths.some((path) => path.includes('.github/skills/scaffold-cli-help/'))).toBe(true);
    expect(changedPaths.some((path) => path.includes('.github/skills/scaffold-core-module/'))).toBe(true);
    expect(changedPaths.some((path) => path.includes('.github/skills/scaffold-feature/'))).toBe(false);

    await rm(root, { recursive: true, force: true });
  });

  it('removes genx-only and non-applicable skills from generated targets', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-agents-cleanup-'));
    await writeFile(
      join(root, 'package.json'),
      `${JSON.stringify({ name: 'x', version: '1.0.0', keywords: ['genx:type:library'] }, null, 2)}\n`,
    );
    await mkdir(join(root, '.github/skills/scaffold-feature'), { recursive: true });
    await mkdir(join(root, '.github/skills/scaffold-cli-help'), { recursive: true });
    await writeFile(join(root, '.github/skills/scaffold-feature/SKILL.md'), 'genx only\n');
    await writeFile(join(root, '.github/skills/scaffold-cli-help/SKILL.md'), 'cli only\n');

    const preview = await previewAiAgents({ targetDir: root });
    const deletes = preview.changes.filter((change) => change.kind === 'delete');

    expect(deletes.some((change) => change.path.endsWith('.github/skills/scaffold-feature/SKILL.md'))).toBe(
      true,
    );
    expect(deletes.some((change) => change.path.endsWith('.github/skills/scaffold-cli-help/SKILL.md'))).toBe(
      true,
    );

    await rm(root, { recursive: true, force: true });
  });
});
