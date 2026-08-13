import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { applyPreviewChanges } from '../../lib/feature-preview/feature-preview.utils.js';
import { previewAiInstructions } from './ai-instructions.preview.js';

/**
 * Ownership semantics from the `@finografic/ai-agent-config` distribution
 * contract, as applied by the ai-instructions feature.
 */

const PROJECT_RULE_REL = '.agents/instructions/project/local.instructions.md';
const AUTHORED = '---\napplyTo: "**"\ndescription: local\n---\n\n# Consumer-authored\n';

async function makeTarget(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'genx-ownership-'));
  await writeFile(
    join(root, 'package.json'),
    `${JSON.stringify({ name: 'x', version: '1.0.0' }, null, 2)}\n`,
  );
  return root;
}

describe('ai-instructions ownership', () => {
  it('seeds the project directory when absent', async () => {
    const root = await makeTarget();

    const preview = await previewAiInstructions({ targetDir: root });
    const seeded = preview.changes.filter(
      (change) => change.path.includes('.agents/instructions/project/') && change.kind === 'write',
    );

    expect(seeded.length).toBeGreaterThan(0);
    expect(seeded.every((change) => change.kind === 'write' && change.currentContent === '')).toBe(true);

    await rm(root, { recursive: true, force: true });
  });

  it('never proposes a change for an existing project-owned file', async () => {
    const root = await makeTarget();
    await mkdir(join(root, '.agents/instructions/project'), { recursive: true });
    // The shipped seed file, already present — should be reported as left untouched.
    await writeFile(join(root, '.agents/instructions/project/.gitkeep'), '', 'utf8');
    // A file the consumer authored, which the manifest does not ship at all.
    await writeFile(join(root, PROJECT_RULE_REL), AUTHORED, 'utf8');

    const preview = await previewAiInstructions({ targetDir: root });

    // Never enumerated, so never a write or delete candidate.
    expect(preview.changes.some((change) => change.path.endsWith(PROJECT_RULE_REL))).toBe(false);
    // The shipped seed file is present, so it is explicitly reported rather than rewritten.
    expect(preview.changes.some((change) => change.path.endsWith('project/.gitkeep'))).toBe(false);
    expect(preview.applied.some((label) => label.includes('project-owned, left untouched'))).toBe(true);

    await rm(root, { recursive: true, force: true });
  });

  it('survives an unattended apply byte-for-byte', async () => {
    const root = await makeTarget();
    await mkdir(join(root, '.agents/instructions/project'), { recursive: true });
    await writeFile(join(root, PROJECT_RULE_REL), AUTHORED, 'utf8');

    // `-y` may skip confirmation for managed assets; it must never reach a seed file. The guarantee
    // is structural: no change is emitted for it, so there is nothing for yesAll to approve.
    const preview = await previewAiInstructions({ targetDir: root });
    await applyPreviewChanges(preview, { yesAll: true });

    expect(await readFile(join(root, PROJECT_RULE_REL), 'utf8')).toBe(AUTHORED);

    await rm(root, { recursive: true, force: true });
  });

  it('applies managed instruction files from the package, then reports no drift', async () => {
    const root = await makeTarget();

    const first = await previewAiInstructions({ targetDir: root });
    await applyPreviewChanges(first, { yesAll: true });

    // Second pass over the same target proposes nothing for the instruction tree.
    const second = await previewAiInstructions({ targetDir: root });
    const instructionChanges = second.changes.filter((change) =>
      change.path.includes('.agents/instructions/'),
    );

    expect(instructionChanges).toEqual([]);

    await rm(root, { recursive: true, force: true });
  });
});
