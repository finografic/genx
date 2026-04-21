import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fg from 'fast-glob';
import { describe, expect, it } from 'vitest';

import { hasPreviewChanges } from '../lib/feature-preview/feature-preview.utils.js';
import { AI_CLAUDE_FILES, AI_CLAUDE_GITIGNORE_LINES } from './ai-claude/ai-claude.constants.js';
import { previewAiClaude } from './ai-claude/ai-claude.preview.js';
import { detectAiInstructions } from './ai-instructions/ai-instructions.detect.js';
import { previewAiInstructions } from './ai-instructions/ai-instructions.preview.js';
import { detectCss } from './css/css.detect.js';
import { previewCss } from './css/css.preview.js';
import { detectMarkdown } from './markdown/markdown.detect.js';
import { previewMarkdown } from './markdown/markdown.preview.js';
import { VITEST_PACKAGE } from './vitest/vitest.constants.js';
import { detectVitest } from './vitest/vitest.detect.js';
import { previewVitest } from './vitest/vitest.preview.js';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

/** Matches `AI_CLAUDE_GITIGNORE_LINES` so ai-claude preview has no .gitignore drift. */
const AI_CLAUDE_GITIGNORE_FIXTURE = `${AI_CLAUDE_GITIGNORE_LINES.join('\n')}\n`;

const aiInstructionsTemplatesPresent =
  existsSync(join(repoRoot, '_templates/.github/copilot-instructions.md')) &&
  existsSync(join(repoRoot, '_templates/.github/instructions'));

/**
 * Copy `_templates` Copilot + instruction files (excluding `project/`) + `AGENTS.md` for aligned-detect
 * tests.
 */
async function seedCanonicalAiInstructions(root: string): Promise<void> {
  await mkdir(join(root, '.github'), { recursive: true });
  const copilotSrc = join(repoRoot, '_templates/.github/copilot-instructions.md');
  await writeFile(join(root, '.github/copilot-instructions.md'), await readFile(copilotSrc, 'utf8'));
  const instRoot = join(repoRoot, '_templates/.github/instructions');
  const relFiles = await fg('**/*', { cwd: instRoot, onlyFiles: true });
  for (const rel of relFiles) {
    if (rel.startsWith('project/') || rel === 'project') continue;
    const src = join(instRoot, rel);
    const dest = join(root, '.github/instructions', rel);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, await readFile(src, 'utf8'));
  }
  await writeFile(
    join(root, 'AGENTS.md'),
    await readFile(join(repoRoot, '_templates/AGENTS.md.template'), 'utf8'),
  );
}

describe('preview migration — drift vs canonical', () => {
  it('markdown: minimal package shows preview drift and detect false', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-md-'));
    await writeFile(
      join(root, 'package.json'),
      `${JSON.stringify({ name: 'x', version: '1.0.0' }, null, 2)}\n`,
    );

    const preview = await previewMarkdown({ targetDir: root });
    expect(hasPreviewChanges(preview)).toBe(true);
    expect(await detectMarkdown({ targetDir: root })).toBe(false);

    await rm(root, { recursive: true, force: true });
  });

  it('vitest: minimal package shows preview drift and detect false', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-vt-'));
    await writeFile(
      join(root, 'package.json'),
      `${JSON.stringify({ name: 'x', version: '1.0.0' }, null, 2)}\n`,
    );

    const preview = await previewVitest({ targetDir: root });
    expect(hasPreviewChanges(preview)).toBe(true);
    expect(preview.changes.some((c) => c.kind === 'write' && c.summary?.includes('vitest'))).toBe(true);
    expect(await detectVitest({ targetDir: root })).toBe(false);

    await rm(root, { recursive: true, force: true });
  });

  it('vitest: detect true when vitest dep and vitest.config.ts exist', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-vt-'));
    const pkg = {
      name: 'x',
      version: '1.0.0',
      devDependencies: { [VITEST_PACKAGE]: '1.0.0' },
      scripts: { 'test': 'vitest', 'test:run': 'vitest run', 'test:coverage': 'vitest run --coverage' },
    };
    await writeFile(join(root, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
    const templateCfg = join(repoRoot, '_templates/vitest.config.ts');
    await writeFile(join(root, 'vitest.config.ts'), await readFile(templateCfg, 'utf8'));

    const preview = await previewVitest({ targetDir: root });
    expect(hasPreviewChanges(preview)).toBe(false);
    expect(await detectVitest({ targetDir: root })).toBe(true);

    await rm(root, { recursive: true, force: true });
  });

  it('css: minimal package shows preview drift and detect false', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-css-'));
    await writeFile(
      join(root, 'package.json'),
      `${JSON.stringify({ name: 'x', version: '1.0.0' }, null, 2)}\n`,
    );

    const preview = await previewCss({ targetDir: root });
    expect(hasPreviewChanges(preview)).toBe(true);
    expect(await detectCss({ targetDir: root })).toBe(false);

    await rm(root, { recursive: true, force: true });
  });

  it.skipIf(!aiInstructionsTemplatesPresent)(
    'ai-instructions: missing copilot file shows preview drift',
    async () => {
      const root = await mkdtemp(join(tmpdir(), 'genx-aii-'));
      await writeFile(
        join(root, 'package.json'),
        `${JSON.stringify({ name: 'x', version: '1.0.0' }, null, 2)}\n`,
      );

      const preview = await previewAiInstructions({ targetDir: root });
      expect(hasPreviewChanges(preview)).toBe(true);
      expect(await detectAiInstructions({ targetDir: root })).toBe(false);

      await rm(root, { recursive: true, force: true });
    },
  );

  it.skipIf(!aiInstructionsTemplatesPresent)(
    'ai-instructions: detect true when canonical template files match',
    async () => {
      const root = await mkdtemp(join(tmpdir(), 'genx-aii-'));
      await writeFile(
        join(root, 'package.json'),
        `${JSON.stringify({ name: 'x', version: '1.0.0' }, null, 2)}\n`,
      );
      await seedCanonicalAiInstructions(root);

      const preview = await previewAiInstructions({ targetDir: root });
      expect(hasPreviewChanges(preview)).toBe(false);
      expect(await detectAiInstructions({ targetDir: root })).toBe(true);

      await rm(root, { recursive: true, force: true });
    },
  );

  it.skipIf(!aiInstructionsTemplatesPresent)(
    'ai-instructions: missing instruction files vs template show drift',
    async () => {
      const root = await mkdtemp(join(tmpdir(), 'genx-aii-miss-'));
      await writeFile(
        join(root, 'package.json'),
        `${JSON.stringify({ name: 'x', version: '1.0.0' }, null, 2)}\n`,
      );
      await seedCanonicalAiInstructions(root);
      await rm(join(root, '.github/instructions/documentation/agent-facing-markdown.instructions.md'));
      await rm(join(root, '.github/instructions/documentation/feature-design-specs.instructions.md'));

      const preview = await previewAiInstructions({ targetDir: root });
      expect(hasPreviewChanges(preview)).toBe(true);
      expect(
        preview.changes.some(
          (c) => c.kind === 'write' && c.path.includes('agent-facing-markdown.instructions.md'),
        ),
      ).toBe(true);

      await rm(root, { recursive: true, force: true });
    },
  );

  it('ai-claude: preview includes .claude/assets/.gitkeep when the assets directory is missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-claude-'));
    await writeFile(
      join(root, 'package.json'),
      `${JSON.stringify({ name: 'x', version: '1.0.0' }, null, 2)}\n`,
    );
    await mkdir(join(root, '.github/instructions'), { recursive: true });

    for (const f of AI_CLAUDE_FILES) {
      const p = join(root, f);
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, 'ok\n');
    }
    await writeFile(join(root, '.gitignore'), AI_CLAUDE_GITIGNORE_FIXTURE);
    await writeFile(join(root, 'eslint.config.ts'), `export default { ignores: ['**/.claude/**'] };\n`);

    const preview = await previewAiClaude({ targetDir: root });
    expect(
      preview.changes.some((c) => c.kind === 'write' && c.path.endsWith('.claude/assets/.gitkeep')),
    ).toBe(true);
    expect(hasPreviewChanges(preview)).toBe(true);

    await rm(root, { recursive: true, force: true });
  });

  it('ai-claude: no assets gitkeep change when .claude/assets exists (preview/apply parity)', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-claude-'));
    await writeFile(
      join(root, 'package.json'),
      `${JSON.stringify({ name: 'x', version: '1.0.0' }, null, 2)}\n`,
    );
    await mkdir(join(root, '.github/instructions'), { recursive: true });

    for (const f of AI_CLAUDE_FILES) {
      const p = join(root, f);
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, 'ok\n');
    }
    await mkdir(join(root, '.claude/assets'), { recursive: true });
    await writeFile(join(root, '.gitignore'), AI_CLAUDE_GITIGNORE_FIXTURE);
    await writeFile(join(root, 'eslint.config.ts'), `export default { ignores: ['**/.claude/**'] };\n`);

    const preview = await previewAiClaude({ targetDir: root });
    expect(preview.changes.some((c) => c.path.endsWith('.gitkeep'))).toBe(false);
    expect(hasPreviewChanges(preview)).toBe(false);

    await rm(root, { recursive: true, force: true });
  });
});
