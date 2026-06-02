import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { hasPreviewChanges } from '../../lib/feature-preview/feature-preview.utils.js';
import { detectAiMemory } from './ai-memory.detect.js';
import { previewAiMemory } from './ai-memory.preview.js';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));

describe('ai-memory preview-driven detect', () => {
  it('proposes work for a fresh repo', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-memory-'));
    await writeFile(
      join(root, 'package.json'),
      `${JSON.stringify({ name: 'x', version: '1.0.0' }, null, 2)}\n`,
    );

    const preview = await previewAiMemory({ targetDir: root });
    expect(hasPreviewChanges(preview)).toBe(true);
    expect(
      preview.changes.some(
        (c) => c.kind === 'write' && c.path.endsWith('docs/process/PROJECT_MEMORY_MODEL.md'),
      ),
    ).toBe(true);
    expect(await detectAiMemory({ targetDir: root })).toBe(false);

    await rm(root, { recursive: true, force: true });
  });

  it('migrates legacy .claude/memory.md into .agents/memory.md and deletes the legacy file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-memory-'));
    await writeFile(
      join(root, 'package.json'),
      `${JSON.stringify({ name: 'x', version: '1.0.0' }, null, 2)}\n`,
    );
    await mkdir(join(root, '.claude'), { recursive: true });
    await mkdir(join(root, '.github/instructions'), { recursive: true });
    await writeFile(join(root, '.claude/memory.md'), '# Session Memory\n\nLegacy note\n');
    await writeFile(
      join(root, 'AGENTS.md'),
      await readFile(join(repoRoot, '_templates/AGENTS.md.template'), 'utf8'),
    );
    await writeFile(
      join(root, '.gitignore'),
      await readFile(join(repoRoot, '_templates/.gitignore'), 'utf8'),
    );
    await writeFile(join(root, 'CLAUDE.md'), '@AGENTS.md\n');

    const preview = await previewAiMemory({ targetDir: root });
    const memoryWrite = preview.changes.find(
      (c): c is Extract<(typeof preview.changes)[number], { kind: 'write' }> =>
        c.kind === 'write' && c.path.endsWith('.agents/memory.md'),
    );
    expect(memoryWrite).toBeDefined();
    expect(memoryWrite!.proposedContent).toContain('Legacy note');
    expect(memoryWrite!.proposedContent).not.toContain('Imported from `.claude/memory.md`');
    expect(preview.changes.some((c) => c.kind === 'delete' && c.path.endsWith('.claude/memory.md'))).toBe(
      true,
    );

    await rm(root, { recursive: true, force: true });
  });

  it('imports legacy .claude/handoff.md and deletes the legacy file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-memory-'));
    await writeFile(
      join(root, 'package.json'),
      `${JSON.stringify({ name: 'x', version: '1.0.0' }, null, 2)}\n`,
    );
    await mkdir(join(root, '.claude'), { recursive: true });
    await mkdir(join(root, '.github/instructions'), { recursive: true });
    await writeFile(join(root, '.claude/handoff.md'), '# Legacy Handoff\n\nOld state\n');
    await writeFile(
      join(root, 'AGENTS.md'),
      await readFile(join(repoRoot, '_templates/AGENTS.md.template'), 'utf8'),
    );
    await writeFile(
      join(root, '.gitignore'),
      await readFile(join(repoRoot, '_templates/.gitignore'), 'utf8'),
    );
    await writeFile(join(root, 'CLAUDE.md'), '@AGENTS.md\n');

    const preview = await previewAiMemory({ targetDir: root });
    const handoffWrite = preview.changes.find(
      (c): c is Extract<(typeof preview.changes)[number], { kind: 'write' }> =>
        c.kind === 'write' && c.path.endsWith('.agents/handoff.md'),
    );
    expect(handoffWrite).toBeDefined();
    expect(handoffWrite!.proposedContent).not.toContain('Imported from `.claude/handoff.md`');
    expect(handoffWrite!.proposedContent).toContain('Old state');
    expect(preview.changes.some((c) => c.kind === 'delete' && c.path.endsWith('.claude/handoff.md'))).toBe(
      true,
    );

    await rm(root, { recursive: true, force: true });
  });

  it('does not overwrite existing roadmap or next steps content', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-memory-'));
    await writeFile(
      join(root, 'package.json'),
      `${JSON.stringify({ name: 'x', version: '1.0.0' }, null, 2)}\n`,
    );
    await mkdir(join(root, 'docs/process'), { recursive: true });
    await mkdir(join(root, 'docs/todo'), { recursive: true });
    await mkdir(join(root, '.agents'), { recursive: true });
    await mkdir(join(root, '.github/instructions'), { recursive: true });
    await writeFile(join(root, 'docs/process/PROJECT_MEMORY_MODEL.md'), 'custom model\n');
    await writeFile(join(root, 'docs/todo/ROADMAP.md'), '# Custom Roadmap\n\nKeep me\n');
    await writeFile(join(root, 'docs/todo/NEXT_STEPS.md'), '# Custom Next\n\nKeep me too\n');
    await writeFile(join(root, '.agents/handoff.md'), 'handoff ok\n');
    await writeFile(join(root, '.agents/memory.md'), 'memory ok\n');
    await writeFile(
      join(root, 'AGENTS.md'),
      await readFile(join(repoRoot, '_templates/AGENTS.md.template'), 'utf8'),
    );
    await writeFile(
      join(root, '.gitignore'),
      await readFile(join(repoRoot, '_templates/.gitignore'), 'utf8'),
    );
    await writeFile(join(root, 'CLAUDE.md'), '@AGENTS.md\n');

    const preview = await previewAiMemory({ targetDir: root });
    expect(preview.changes.some((c) => c.path.endsWith('docs/todo/ROADMAP.md'))).toBe(false);
    expect(preview.changes.some((c) => c.path.endsWith('docs/todo/NEXT_STEPS.md'))).toBe(false);

    await rm(root, { recursive: true, force: true });
  });
});
