import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { agentAssetsSourceRoot } from '../../lib/agent-assets/index.js';
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

  /**
   * Copy the shipped skill trees from the installed `@finografic/ai-agent-config` assets — the same
   * source the preview reads. Skills are `managed`, so alignment means the file **contents** match,
   * not merely that a directory exists.
   */
  async function seedCanonicalSkills(root: string, only?: (skillDir: string) => boolean): Promise<void> {
    const skillsSrc = join(agentAssetsSourceRoot, 'skills');
    for (const skillsDest of [join(root, '.agents/skills'), join(root, '.claude/skills')]) {
      for (const ent of await readdir(skillsSrc, { withFileTypes: true })) {
        if (!ent.isDirectory()) continue;
        if (only && !only(ent.name)) continue;
        const destDir = join(skillsDest, ent.name);
        await mkdir(destDir, { recursive: true });
        for (const file of await readdir(join(skillsSrc, ent.name), { withFileTypes: true })) {
          if (!file.isFile()) continue;
          await writeFile(
            join(destDir, file.name),
            await readFile(join(skillsSrc, ent.name, file.name), 'utf8'),
          );
        }
      }
    }
  }

  it('detects no drift when AGENTS.md and skill contents match canonical', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-agents-'));
    await writeFile(
      join(root, 'package.json'),
      `${JSON.stringify({ name: 'x', version: '1.0.0', keywords: ['genx:type:cli'] }, null, 2)}\n`,
    );

    const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
    const templateAgents = join(repoRoot, '_templates/AGENTS.md.template');
    await writeFile(join(root, 'AGENTS.md'), await readFile(templateAgents, 'utf8'));
    await seedCanonicalSkills(root);

    const preview = await previewAiAgents({ targetDir: root });
    expect(hasPreviewChanges(preview)).toBe(false);
    expect(await detectAiAgents({ targetDir: root })).toBe(true);

    await rm(root, { recursive: true, force: true });
  });

  it('skills are managed: an edited shared skill is proposed for replacement', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-agents-drift-'));
    await writeFile(
      join(root, 'package.json'),
      `${JSON.stringify({ name: 'x', version: '1.0.0', keywords: ['genx:type:cli'] }, null, 2)}\n`,
    );
    const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
    await writeFile(
      join(root, 'AGENTS.md'),
      await readFile(join(repoRoot, '_templates/AGENTS.md.template'), 'utf8'),
    );
    await seedCanonicalSkills(root);

    // Local drift in a shared skill: canonical must win after preview, otherwise upstream skill
    // updates could never reach a consumer that had already installed them once.
    const drifted = join(root, '.agents/skills/maintain-agents/SKILL.md');
    await writeFile(drifted, 'locally edited\n');

    const preview = await previewAiAgents({ targetDir: root });
    const write = preview.changes.find((change) => change.path === drifted);
    expect(write?.kind).toBe('write');
    expect(write?.kind === 'write' && write.currentContent).toBe('locally edited\n');
    expect(write?.kind === 'write' && write.proposedContent).toContain('maintain-agents');

    await rm(root, { recursive: true, force: true });
  });

  it('leaves project-authored skills untouched', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-agents-own-'));
    await writeFile(
      join(root, 'package.json'),
      `${JSON.stringify({ name: 'x', version: '1.0.0', keywords: ['genx:type:cli'] }, null, 2)}\n`,
    );
    const ownSkill = join(root, '.agents/skills/my-own-skill/SKILL.md');
    await mkdir(dirname(ownSkill), { recursive: true });
    await writeFile(ownSkill, '# mine\n');

    const preview = await previewAiAgents({ targetDir: root });

    // Only manifest-shipped skills are enumerated, so a project's own skill is never a candidate
    // for write or delete.
    expect(preview.changes.some((change) => change.path === ownSkill)).toBe(false);

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

    expect(changedPaths.some((path) => path.includes('.agents/skills/maintain-agents/'))).toBe(true);
    expect(changedPaths.some((path) => path.includes('.claude/skills/maintain-agents/'))).toBe(true);
    expect(changedPaths.some((path) => path.includes('/skills/scaffold-cli-help/'))).toBe(false);
    expect(changedPaths.some((path) => path.includes('/skills/scaffold-core-module/'))).toBe(false);
    expect(changedPaths.some((path) => path.includes('/skills/scaffold-feature/'))).toBe(false);

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

    expect(changedPaths.some((path) => path.includes('.agents/skills/maintain-agents/'))).toBe(true);
    expect(changedPaths.some((path) => path.includes('.claude/skills/maintain-agents/'))).toBe(true);
    expect(changedPaths.some((path) => path.includes('.agents/skills/scaffold-cli-help/'))).toBe(true);
    expect(changedPaths.some((path) => path.includes('.claude/skills/scaffold-cli-help/'))).toBe(true);
    expect(changedPaths.some((path) => path.includes('.agents/skills/scaffold-core-module/'))).toBe(true);
    expect(changedPaths.some((path) => path.includes('.claude/skills/scaffold-core-module/'))).toBe(true);
    expect(changedPaths.some((path) => path.includes('/skills/scaffold-feature/'))).toBe(false);

    await rm(root, { recursive: true, force: true });
  });

  it('removes genx-only and non-applicable skills from generated targets', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-agents-cleanup-'));
    await writeFile(
      join(root, 'package.json'),
      `${JSON.stringify({ name: 'x', version: '1.0.0', keywords: ['genx:type:library'] }, null, 2)}\n`,
    );
    for (const skillsRoot of [join(root, '.agents/skills'), join(root, '.claude/skills')]) {
      await mkdir(join(skillsRoot, 'scaffold-feature'), { recursive: true });
      await mkdir(join(skillsRoot, 'scaffold-cli-help'), { recursive: true });
      await writeFile(join(skillsRoot, 'scaffold-feature/SKILL.md'), 'genx only\n');
      await writeFile(join(skillsRoot, 'scaffold-cli-help/SKILL.md'), 'cli only\n');
    }

    const preview = await previewAiAgents({ targetDir: root });
    const deletes = preview.changes.filter((change) => change.kind === 'delete');

    expect(deletes.some((change) => change.path.endsWith('.agents/skills/scaffold-feature/SKILL.md'))).toBe(
      true,
    );
    expect(deletes.some((change) => change.path.endsWith('.claude/skills/scaffold-feature/SKILL.md'))).toBe(
      true,
    );
    expect(deletes.some((change) => change.path.endsWith('.agents/skills/scaffold-cli-help/SKILL.md'))).toBe(
      true,
    );
    expect(deletes.some((change) => change.path.endsWith('.claude/skills/scaffold-cli-help/SKILL.md'))).toBe(
      true,
    );

    await rm(root, { recursive: true, force: true });
  });
});
