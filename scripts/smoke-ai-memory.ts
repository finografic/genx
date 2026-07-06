#!/usr/bin/env tsx
/**
 * Non-interactive smoke test for `ai-memory` via the same apply path as `genx features`.
 *
 * Usage:
 * pnpm build && pnpm smoke:ai-memory
 */
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { detectAiMemory } from '../src/features/ai-memory/ai-memory.detect.js';
import { previewAiMemory } from '../src/features/ai-memory/ai-memory.preview.js';
import { applyFeaturesToTarget } from '../src/lib/features/apply-features.runner.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureSrc = join(repoRoot, 'test/fixtures/minimal-package');

async function assertExists(root: string, rel: string): Promise<void> {
  const abs = join(root, rel);
  await readFile(abs, 'utf8');
}

async function main(): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), 'genx-smoke-memory-'));
  try {
    await cp(fixtureSrc, root, { recursive: true });

    console.log(`fixture: ${root}`);

    await applyFeaturesToTarget(root, ['aiMemory'], { commitEachFeature: false, yesAll: true });

    await assertExists(root, 'docs/process/PROJECT_MEMORY_MODEL.md');
    await assertExists(root, 'docs/todo/ROADMAP.md');
    await assertExists(root, 'docs/todo/NEXT_STEPS.md');
    await assertExists(root, '.agents/handoff.md');
    await assertExists(root, '.agents/memory.md');
    await assertExists(root, 'CLAUDE.md');
    await assertExists(root, 'AGENTS.md');

    const agents = await readFile(join(root, 'AGENTS.md'), 'utf8');
    if (!agents.includes('## Project Memory Model')) {
      throw new Error('AGENTS.md missing ## Project Memory Model');
    }

    const claude = await readFile(join(root, 'CLAUDE.md'), 'utf8');
    if (claude.trim() !== '@AGENTS.md') {
      throw new Error(`CLAUDE.md expected @AGENTS.md shim, got: ${claude.trim()}`);
    }

    const installed = await detectAiMemory({ targetDir: root });
    if (!installed) {
      const preview = await previewAiMemory({ targetDir: root });
      const remaining = preview.changes.map((c) => c.summary ?? c.path).join(', ');
      throw new Error(`detectAiMemory returned false after first apply. Remaining: ${remaining}`);
    }

    await applyFeaturesToTarget(root, ['aiMemory'], { commitEachFeature: false, yesAll: true });
    const stillInstalled = await detectAiMemory({ targetDir: root });
    if (!stillInstalled) {
      throw new Error('detectAiMemory returned false after second apply (expected idempotent)');
    }

    console.log('smoke: ai-memory apply + idempotent detect OK');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
