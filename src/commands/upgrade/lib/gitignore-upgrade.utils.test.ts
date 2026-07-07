import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { getCanonicalGitignoreBody } from 'lib/agents-gitignore.utils.js';

import { planGitignoreUpgrade, proposeTargetGitignore } from './gitignore-upgrade.utils.js';

describe('gitignore-upgrade.utils', () => {
  it('proposeTargetGitignore returns canonical body for empty input', () => {
    expect(proposeTargetGitignore('')).toBe(`${getCanonicalGitignoreBody()}\n`);
  });

  it('planGitignoreUpgrade detects outdated gitignore and preserves project extras', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-gitignore-upgrade-'));
    try {
      await writeFile(
        join(root, '.gitignore'),
        `# Agents
.old-agents/

# Project-specific
vendor-cache/
`,
        'utf8',
      );

      const plan = await planGitignoreUpgrade(root);
      expect(plan.changed).toBe(true);
      expect(plan.proposed).toContain('# Agents');
      expect(plan.proposed).not.toContain('.old-agents/');
      expect(plan.proposed).toContain('# Project-specific');
      expect(plan.proposed).toContain('vendor-cache/');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('planGitignoreUpgrade creates plan for missing .gitignore', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-gitignore-upgrade-'));
    try {
      const plan = await planGitignoreUpgrade(root);
      expect(plan.changed).toBe(true);
      expect(plan.proposed).toBe(`${getCanonicalGitignoreBody()}\n`);
      expect(await readFile(plan.gitignorePath, 'utf8').catch(() => null)).toBeNull();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
