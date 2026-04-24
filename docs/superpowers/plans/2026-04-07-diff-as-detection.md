# Diff-as-Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hand-written feature detection with preview-and-diff truth, starting with shared preview infrastructure and rolling the pattern across existing features without changing canonical `src/core/` modules in the first pass.

**Architecture:** Add a grouped `src/lib/feature-preview/` folder for non-core preview/change-set utilities, keep file-specific positioning logic inside feature mutators, and make `detect()` ask whether the preview yields any changed file operations. `apply()` reuses the same preview result, confirms one diff per changed file, writes approved changes, and runs one post-write install step when manifest changes require it.

**Tech Stack:** TypeScript, Vitest, jsdiff (`diff`), `@clack/prompts`, existing `core/file-diff`, existing feature modules under `src/features/`

---

## File Structure

### New grouped utilities

- Create: `src/lib/feature-preview/feature-preview.types.ts`
- Create: `src/lib/feature-preview/feature-preview.utils.ts`
- Create: `src/lib/feature-preview/index.ts`
- Create: `src/lib/feature-preview/feature-preview.test.ts`

Purpose:

- Keep all diff-as-detection infrastructure outside canonical `src/core/` but in one folder for easy maintenance and possible future promotion.
- Centralize whole-file preview operations (`write`, `delete`) plus one post-apply install flag.

### Feature migrations

- Create: `src/features/oxfmt/oxfmt.preview.ts`
- Create: `src/features/oxfmt/oxfmt.preview.test.ts`
- Modify: `src/features/oxfmt/oxfmt.apply.ts`
- Modify: `src/features/oxfmt/oxfmt.detect.ts`
- Create: `src/features/markdown/markdown.preview.ts`
- Create: `src/features/git-hooks/git-hooks.preview.ts`
- Create: `src/features/vitest/vitest.preview.ts`
- Create: `src/features/ai-agents/ai-agents.preview.ts`
- Create: `src/features/ai-claude/ai-claude.preview.ts`
- Create: `src/features/ai-instructions/ai-instructions.preview.ts`
- Create: `src/features/css/css.preview.ts`
- Modify corresponding `*.apply.ts` / `*.detect.ts` files to use previews

Purpose:

- Move each feature’s canonical end-state logic into a reusable preview function.
- Keep positioning logic local to the feature and its file mutators.

### Optional repeatable skill

- Create: `.github/skills/scaffold-feature-preview/SKILL.md`

Purpose:

- Capture the preview/detect/apply pattern once it is proven across multiple converted features.

### Documentation and state

- Modify: `docs/todo/TODO.ROADMAP.md`
- Modify: `.claude/memory.md`
- Modify: `.agents/handoff.md`

Purpose:

- Record the architectural shift and mark roadmap item `#3` complete.

---

### Task 1: Add Preview Infrastructure

**Files:**

- Create: `src/lib/feature-preview/feature-preview.types.ts`
- Create: `src/lib/feature-preview/feature-preview.utils.ts`
- Create: `src/lib/feature-preview/index.ts`
- Test: `src/lib/feature-preview/feature-preview.test.ts`

- [ ] **Step 1: Write the failing infrastructure tests**

```ts
import { describe, expect, it } from 'vitest';

import {
  applyPreviewChanges,
  createDeleteChange,
  createWriteChange,
  getChangedPreviewChanges,
  hasPreviewChanges,
} from './index';

describe('feature-preview', () => {
  it('marks identical write changes as unchanged', () => {
    const change = createWriteChange({
      path: 'package.json',
      currentContent: '{\n}\n',
      proposedContent: '{\n}\n',
      summary: 'package.json',
    });

    expect(change.changed).toBe(false);
    expect(hasPreviewChanges([change])).toBe(false);
  });

  it('marks changed writes and deletes as changed', () => {
    const write = createWriteChange({
      path: 'AGENTS.md',
      currentContent: '',
      proposedContent: '# AGENTS\n',
      summary: 'AGENTS.md',
    });
    const del = createDeleteChange({
      path: '.prettierrc',
      currentContent: '{ }\n',
      summary: 'remove prettier config',
    });

    expect(getChangedPreviewChanges([write, del])).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/lib/feature-preview/feature-preview.test.ts`
Expected: FAIL with module-not-found errors for `src/lib/feature-preview/*`

- [ ] **Step 3: Add preview types and utilities**

```ts
// src/lib/feature-preview/feature-preview.types.ts
export interface PreviewChangeBase {
  path: string;
  summary: string;
  changed: boolean;
}

export interface PreviewWriteChange extends PreviewChangeBase {
  kind: 'write';
  currentContent: string;
  proposedContent: string;
}

export interface PreviewDeleteChange extends PreviewChangeBase {
  kind: 'delete';
  currentContent: string;
  proposedContent: '';
}

export type PreviewChange = PreviewWriteChange | PreviewDeleteChange;

export interface FeaturePreviewResult {
  changes: PreviewChange[];
  applied: string[];
  noopMessage?: string;
  needsInstall?: boolean;
}
```

```ts
// src/lib/feature-preview/feature-preview.utils.ts
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { confirmFileWrite, createDiffConfirmState } from 'core/file-diff';

import type { FeatureApplyResult } from 'features/feature.types';
import type {
  FeaturePreviewResult,
  PreviewChange,
  PreviewDeleteChange,
  PreviewWriteChange,
} from './feature-preview.types.js';

export function createWriteChange(input: Omit<PreviewWriteChange, 'kind' | 'changed'>): PreviewWriteChange {
  return {
    kind: 'write',
    ...input,
    changed: input.currentContent !== input.proposedContent,
  };
}

export function createDeleteChange(
  input: Omit<PreviewDeleteChange, 'kind' | 'changed' | 'proposedContent'>,
): PreviewDeleteChange {
  return {
    kind: 'delete',
    ...input,
    proposedContent: '',
    changed: input.currentContent !== '',
  };
}

export function getChangedPreviewChanges(changes: PreviewChange[]): PreviewChange[] {
  return changes.filter((change) => change.changed);
}

export function hasPreviewChanges(changes: PreviewChange[]): boolean {
  return getChangedPreviewChanges(changes).length > 0;
}

export async function applyPreviewChanges(preview: FeaturePreviewResult): Promise<FeatureApplyResult> {
  const diffState = createDiffConfirmState();
  const changed = getChangedPreviewChanges(preview.changes);

  if (changed.length === 0) {
    return { applied: [], noopMessage: preview.noopMessage };
  }

  const written: string[] = [];
  for (const change of changed) {
    const action = await confirmFileWrite(
      change.path,
      change.currentContent,
      change.proposedContent,
      diffState,
    );

    if (action === 'skip') continue;

    if (change.kind === 'delete') {
      await rm(change.path, { force: true });
    } else {
      await mkdir(dirname(change.path), { recursive: true });
      await writeFile(change.path, change.proposedContent, 'utf8');
    }

    written.push(change.summary);
  }

  return written.length > 0
    ? { applied: preview.applied.filter((label) => written.includes(label) || preview.applied.length === 1) }
    : { applied: [], noopMessage: preview.noopMessage };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/lib/feature-preview/feature-preview.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/feature-preview docs/superpowers/plans/2026-04-07-diff-as-detection.md
git commit -m "feat: add feature preview infrastructure"
```

### Task 2: Convert `oxfmt` To Preview-Driven Detection

**Files:**

- Create: `src/features/oxfmt/oxfmt.preview.ts`
- Create: `src/features/oxfmt/oxfmt.preview.test.ts`
- Modify: `src/features/oxfmt/oxfmt.detect.ts`
- Modify: `src/features/oxfmt/oxfmt.apply.ts`
- Test: `src/features/oxfmt/oxfmt.preview.test.ts`

- [ ] **Step 1: Write the failing oxfmt preview tests**

```ts
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { previewOxfmt } from './oxfmt.preview';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('previewOxfmt', () => {
  it('reports package.json drift when update:oxfmt-config is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'genx-oxfmt-preview-'));
    tempDirs.push(dir);

    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({
        name: '@finografic/example',
        type: 'module',
        devDependencies: {
          oxfmt: '^0.43.0',
          '@finografic/oxfmt-config': '^1.0.3',
        },
        scripts: {
          format:check: 'oxfmt --check',
        },
      }, null, 2) + '\n',
      'utf8',
    );

    const preview = await previewOxfmt({ targetDir: dir });
    expect(preview.changes.some((change) => change.path.endsWith('package.json') && change.changed)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/features/oxfmt/oxfmt.preview.test.ts`
Expected: FAIL with `Cannot find module './oxfmt.preview'`

- [ ] **Step 3: Add `oxfmt.preview.ts` and migrate `detect()`**

```ts
// src/features/oxfmt/oxfmt.preview.ts
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { createDeleteChange, createWriteChange, type FeaturePreviewResult } from 'lib/feature-preview';
import type { FeatureContext } from '../feature.types';

export async function previewOxfmt(context: FeatureContext): Promise<FeaturePreviewResult> {
  const packageJsonPath = resolve(context.targetDir, 'package.json');
  const packageJsonCurrent = await readFile(packageJsonPath, 'utf8');
  const packageJsonNext = await buildNextOxfmtPackageJson(packageJsonCurrent);

  const changes = [
    createWriteChange({
      path: packageJsonPath,
      currentContent: packageJsonCurrent,
      proposedContent: packageJsonNext,
      summary: 'package.json',
    }),
    await previewOxfmtConfig(context.targetDir),
    ...(await previewPrettierBackupDeletes(context.targetDir)),
    ...(await previewWorkflowUpdates(context.targetDir)),
    ...(await previewVSCodeUpdates(context.targetDir)),
  ];

  return {
    changes,
    applied: getChangedPreviewChanges(changes).map((change) => change.summary),
    noopMessage: 'oxfmt already installed. No changes made.',
    needsInstall: changes.some((change) => change.path.endsWith('package.json') && change.changed),
  };
}
```

```ts
// src/features/oxfmt/oxfmt.detect.ts
import { hasPreviewChanges } from 'lib/feature-preview';

import type { FeatureContext } from '../feature.types';
import { previewOxfmt } from './oxfmt.preview';

export async function detectOxfmt(context: FeatureContext): Promise<boolean> {
  const preview = await previewOxfmt(context);
  return !hasPreviewChanges(preview.changes);
}
```

- [ ] **Step 4: Run the targeted tests**

Run: `pnpm test:run src/features/oxfmt/oxfmt.preview.test.ts`
Expected: PASS

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/oxfmt src/lib/feature-preview
git commit -m "refactor: drive oxfmt detection from preview diffs"
```

### Task 3: Convert `oxfmt` Apply To Preview + One Post-Write Install

**Files:**

- Modify: `src/features/oxfmt/oxfmt.apply.ts`
- Modify: `src/features/oxfmt/oxfmt.preview.ts`
- Test: `src/features/oxfmt/oxfmt.preview.test.ts`

- [ ] **Step 1: Write the failing apply regression test**

```ts
import { describe, expect, it, vi } from 'vitest';

import * as featurePreview from 'lib/feature-preview';
import { applyOxfmt } from './oxfmt.apply';

vi.mock('lib/feature-preview', async () => {
  const actual = await vi.importActual<typeof import('lib/feature-preview')>('lib/feature-preview');
  return {
    ...actual,
    applyPreviewChanges: vi.fn().mockResolvedValue({ applied: ['package.json'] }),
  };
});

describe('applyOxfmt', () => {
  it('runs preview-driven writes and returns applied summaries', async () => {
    const result = await applyOxfmt({ targetDir: '/tmp/example' });
    expect(result.applied).toContain('package.json');
    expect(featurePreview.applyPreviewChanges).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/features/oxfmt/oxfmt.preview.test.ts`
Expected: FAIL because `applyOxfmt` still uses direct side effects

- [ ] **Step 3: Replace direct write/install flow with preview execution**

```ts
// src/features/oxfmt/oxfmt.apply.ts
import { spinner } from 'utils';
import { applyPreviewChanges } from 'lib/feature-preview';

import type { FeatureApplyResult, FeatureContext } from '../feature.types';
import { previewOxfmt } from './oxfmt.preview';

export async function applyOxfmt(context: FeatureContext): Promise<FeatureApplyResult> {
  const preview = await previewOxfmt(context);
  const result = await applyPreviewChanges(preview);

  if (preview.needsInstall && result.applied.length > 0) {
    const installSpin = spinner();
    installSpin.start('Installing dependencies...');
    await runPackageInstall(context.targetDir);
    installSpin.stop('Installed updated dependencies');
  }

  return result.applied.length > 0
    ? result
    : { applied: [], noopMessage: 'oxfmt already installed. No changes made.' };
}
```

- [ ] **Step 4: Run focused verification**

Run: `pnpm test:run src/features/oxfmt/oxfmt.preview.test.ts`
Expected: PASS

Run: `pnpm test:run src/lib/feature-preview/feature-preview.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/oxfmt src/lib/feature-preview
git commit -m "refactor: apply oxfmt from preview changes"
```

### Task 4: Convert The Remaining Features To Preview Functions

**Files:**

- Create: `src/features/markdown/markdown.preview.ts`
- Create: `src/features/git-hooks/git-hooks.preview.ts`
- Create: `src/features/vitest/vitest.preview.ts`
- Create: `src/features/ai-agents/ai-agents.preview.ts`
- Create: `src/features/ai-claude/ai-claude.preview.ts`
- Create: `src/features/ai-instructions/ai-instructions.preview.ts`
- Create: `src/features/css/css.preview.ts`
- Modify: corresponding `*.detect.ts`
- Modify: corresponding `*.apply.ts`
- Test: add or extend `*.test.ts` files next to each converted feature

- [ ] **Step 1: Write one failing detect test per representative feature**

```ts
import { describe, expect, it } from 'vitest';

import { detectAiAgents } from './ai-agents.detect';

describe('detectAiAgents', () => {
  it('returns false when preview would update AGENTS.md section bodies', async () => {
    const detected = await detectAiAgents({ targetDir: '/tmp/fixture-with-diverged-agents' });
    expect(detected).toBe(false);
  });
});
```

```ts
import { describe, expect, it } from 'vitest';

import { detectGitHooks } from './git-hooks.detect';

describe('detectGitHooks', () => {
  it('returns false when commitlint config still lives in package.json', async () => {
    const detected = await detectGitHooks({ targetDir: '/tmp/fixture-inline-commitlint' });
    expect(detected).toBe(false);
  });
});
```

- [ ] **Step 2: Run targeted tests to verify they fail**

Run: `pnpm test:run src/features/ai-agents src/features/git-hooks src/features/markdown src/features/vitest src/features/css`
Expected: FAIL because preview modules are not wired yet

- [ ] **Step 3: Add preview modules and swap detect/apply to preview-driven flow**

```ts
// representative pattern for each feature
import { applyPreviewChanges, hasPreviewChanges } from 'lib/feature-preview';

import type { FeatureApplyResult, FeatureContext } from '../feature.types';
import { previewGitHooks } from './git-hooks.preview';

export async function detectGitHooks(context: FeatureContext): Promise<boolean> {
  const preview = await previewGitHooks(context);
  return !hasPreviewChanges(preview.changes);
}

export async function applyGitHooks(context: FeatureContext): Promise<FeatureApplyResult> {
  const preview = await previewGitHooks(context);
  return applyPreviewChanges(preview);
}
```

- [ ] **Step 4: Run the feature conversion test suite**

Run: `pnpm test:run src/features/ai-agents src/features/git-hooks src/features/markdown src/features/vitest src/features/css src/features/ai-claude src/features/ai-instructions`
Expected: PASS

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features src/lib/feature-preview
git commit -m "refactor: move remaining features to preview diffs"
```

### Task 5: Add A Repeatable Repo Skill For Preview-Driven Features

**Files:**

- Create: `.github/skills/scaffold-feature-preview/SKILL.md`
- Modify: `AGENTS.md`
- Modify: `_templates/AGENTS.md`

- [ ] **Step 1: Write the failing documentation check**

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('preview skill docs', () => {
  it('lists scaffold-feature-preview in AGENTS.md', () => {
    const content = readFileSync('AGENTS.md', 'utf8');
    expect(content).toContain('scaffold-feature-preview');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run`
Expected: FAIL because the skill and AGENTS references do not exist yet

- [ ] **Step 3: Add the skill and register it in AGENTS docs**

```md
---
name: scaffold-feature-preview
description: Add preview/change-set plumbing to a genx feature before detect/apply drift apart.
---

1. Read the feature's `*.apply.ts`, `*.detect.ts`, and adjacent helpers.
2. Create or update `*.preview.ts` to compute canonical file changes without writing.
3. Keep positioning logic in file-specific mutators.
4. Wire `detect()` to preview emptiness.
5. Wire `apply()` to preview + one prompt per file.
6. Add or update focused preview/detect tests.
```

- [ ] **Step 4: Run docs and lint verification**

Run: `pnpm lint:fix`
Expected: PASS

Run: `pnpm test:run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .github/skills/scaffold-feature-preview AGENTS.md _templates/AGENTS.md
git commit -m "docs: add preview feature skill"
```

### Task 6: Final Verification And State Updates

**Files:**

- Modify: `docs/todo/TODO.ROADMAP.md`
- Modify: `.claude/memory.md`
- Modify: `.agents/handoff.md`

- [ ] **Step 1: Update roadmap and handoff docs**

```md
## 3. Diff-as-detection

- [x] status: **DONE**

Implemented preview-driven feature detection using grouped utilities in `src/lib/feature-preview/`.
```

- [ ] **Step 2: Run full project verification**

Run: `pnpm test:run`
Expected: PASS

Run: `pnpm typecheck`
Expected: PASS

Run: `pnpm lint:fix`
Expected: PASS

- [ ] **Step 3: Run release-level verification**

Run: `pnpm release:check`
Expected: PASS

- [ ] **Step 4: Review git state**

Run: `git status --short`
Expected: only preview/detection/docs changes intended by this plan

- [ ] **Step 5: Commit**

```bash
git add docs/todo/TODO.ROADMAP.md .claude/memory.md .agents/handoff.md
git commit -m "docs: record diff-as-detection rollout"
```
