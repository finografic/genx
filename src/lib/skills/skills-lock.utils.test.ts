import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildSkillsAddArgs, buildSkillsRestoreArgs } from './skills-cli.runner.js';
import { resolveSkillsStatus } from './skills-lock.utils.js';
import { SKILLS_CLI_VERSION, SKILLS_LOCKFILE } from './skills.constants.js';

async function createTarget(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'genx-skills-'));
}

async function writeLock(root: string, names: readonly string[]): Promise<void> {
  const skills = Object.fromEntries(names.map((name) => [name, { source: 'finografic/ai-skills' }]));
  await writeFile(join(root, SKILLS_LOCKFILE), `${JSON.stringify({ version: 1, skills }, null, 2)}\n`);
}

describe('resolveSkillsStatus', () => {
  it('reports a repository with no lockfile as unmigrated', async () => {
    const root = await createTarget();

    await expect(resolveSkillsStatus(root)).resolves.toEqual({
      state: 'unmanaged',
      locked: [],
      missing: [],
    });

    await rm(root, { recursive: true, force: true });
  });

  it('reports every locked skill present as managed', async () => {
    const root = await createTarget();
    await writeLock(root, ['maintain-agents', 'apply-design-md']);
    await mkdir(join(root, '.agents/skills/maintain-agents'), { recursive: true });
    await mkdir(join(root, '.agents/skills/apply-design-md'), { recursive: true });

    const status = await resolveSkillsStatus(root);

    expect(status.state).toBe('managed');
    expect(status.locked).toEqual(['apply-design-md', 'maintain-agents']);
    expect(status.missing).toEqual([]);

    await rm(root, { recursive: true, force: true });
  });

  it('reports a lockfile whose skills are absent as incomplete — the fresh-clone case', async () => {
    const root = await createTarget();
    await writeLock(root, ['maintain-agents', 'apply-design-md']);
    await mkdir(join(root, '.agents/skills/maintain-agents'), { recursive: true });

    const status = await resolveSkillsStatus(root);

    expect(status.state).toBe('incomplete');
    expect(status.missing).toEqual(['apply-design-md']);

    await rm(root, { recursive: true, force: true });
  });

  it('accepts a skill that exists only in the Claude container', async () => {
    // A single-agent install writes real directories there and no canonical copy at all.
    const root = await createTarget();
    await writeLock(root, ['maintain-agents']);
    await mkdir(join(root, '.claude/skills/maintain-agents'), { recursive: true });

    await expect(resolveSkillsStatus(root)).resolves.toMatchObject({ state: 'managed' });

    await rm(root, { recursive: true, force: true });
  });

  it('treats a corrupt lockfile as managed, not as unmigrated', async () => {
    // Falling back to "unmanaged" would restart the dual-write over the CLI's symlinks.
    const root = await createTarget();
    await writeFile(join(root, SKILLS_LOCKFILE), '{ not json');

    await expect(resolveSkillsStatus(root)).resolves.toEqual({
      state: 'managed',
      locked: [],
      missing: [],
    });

    await rm(root, { recursive: true, force: true });
  });
});

describe('skills CLI arguments', () => {
  it('pins the CLI version so an upstream release cannot change a run mid-sweep', () => {
    expect(buildSkillsAddArgs()).toContain(`--package=skills@${SKILLS_CLI_VERSION}`);
    expect(buildSkillsRestoreArgs()).toContain(`--package=skills@${SKILLS_CLI_VERSION}`);
  });

  it('passes each agent as its own flag', () => {
    // The CLI rejects a comma-separated list outright, reporting the whole string as one bad agent.
    const args = buildSkillsAddArgs();

    expect(args).toEqual(expect.arrayContaining(['--agent', 'universal', '--agent', 'claude-code']));
    expect(args.some((arg) => arg.includes(','))).toBe(false);
  });

  it('runs non-interactively over every skill in the source', () => {
    const args = buildSkillsAddArgs();

    expect(args).toEqual(expect.arrayContaining(['add', 'finografic/ai-skills', '--skill', '*', '--yes']));
  });

  it('restores from the lockfile rather than re-resolving the source', () => {
    expect(buildSkillsRestoreArgs()).toContain('experimental_install');
  });
});
