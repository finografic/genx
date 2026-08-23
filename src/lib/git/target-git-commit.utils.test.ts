import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execa } from 'execa';
import { describe, expect, it } from 'vitest';

import { commitAllChanges, findStagedTypeChanges, parseStagedNameStatus } from './target-git-commit.utils.js';

describe('parseStagedNameStatus', () => {
  it('pairs each status with its path', () => {
    expect(parseStagedNameStatus('A\0a.txt\0D\0b.txt\0')).toEqual([
      { status: 'A', path: 'a.txt' },
      { status: 'D', path: 'b.txt' },
    ]);
  });

  it('takes the destination side of a rename', () => {
    // A rename carries two paths; reading the wrong one reports a path that no longer exists.
    expect(parseStagedNameStatus('R100\0old.txt\0new.txt\0M\0other.txt\0')).toEqual([
      { status: 'R100', path: 'new.txt' },
      { status: 'M', path: 'other.txt' },
    ]);
  });

  it('returns nothing for empty output', () => {
    expect(parseStagedNameStatus('')).toEqual([]);
  });
});

describe('findStagedTypeChanges', () => {
  it('flags an added path whose contents are staged as deleted', () => {
    const entries = parseStagedNameStatus(
      'A\0.claude/skills/foo\0D\0.claude/skills/foo/SKILL.md\0D\0.claude/skills/foo/ref.md\0',
    );

    expect(findStagedTypeChanges(entries)).toEqual(['.claude/skills/foo']);
  });

  it('ignores an addition and a deletion that merely share a parent', () => {
    const entries = parseStagedNameStatus('A\0docs/new.md\0D\0docs/old.md\0');

    expect(findStagedTypeChanges(entries)).toEqual([]);
  });

  it('does not treat a prefix match without a path separator as nesting', () => {
    // `foo-bar/SKILL.md` starts with `foo` but is not inside it.
    const entries = parseStagedNameStatus('A\0skills/foo\0D\0skills/foo-bar/SKILL.md\0');

    expect(findStagedTypeChanges(entries)).toEqual([]);
  });

  it('returns nothing when there are no deletions', () => {
    expect(findStagedTypeChanges(parseStagedNameStatus('A\0a.txt\0'))).toEqual([]);
  });
});

/**
 * Replacing a tracked directory with a symlink produces an index `git stash create` cannot
 * serialise, which is what lint-staged uses for its backup. These exercise real git rather than a
 * mock, because the failure lives in git's own refusal to read beyond a symlink.
 */
describe('commitAllChanges type-change split', () => {
  async function createRepoWithVendoredSkill(): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), 'genx-typechange-'));

    await execa('git', ['init', '-q'], { cwd: root });
    await execa('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
    await execa('git', ['config', 'user.name', 'Test'], { cwd: root });

    await mkdir(join(root, '.agents/skills/foo'), { recursive: true });
    await mkdir(join(root, '.claude/skills/foo'), { recursive: true });
    await writeFile(join(root, '.agents/skills/foo/SKILL.md'), 'canonical\n');
    await writeFile(join(root, '.claude/skills/foo/SKILL.md'), 'canonical\n');
    // Tracked, so a later edit shows as modified rather than untracked — the shape `upgrade` leaves.
    await writeFile(join(root, 'package.json'), '{ "name": "x" }\n');

    await execa('git', ['add', '-A'], { cwd: root });
    await execa('git', ['commit', '-qm', 'init'], { cwd: root });

    // What the installer does: the duplicated directory becomes a symlink at the canonical copy.
    await rm(join(root, '.claude/skills/foo'), { recursive: true, force: true });
    await symlink('../../.agents/skills/foo', join(root, '.claude/skills/foo'));

    return root;
  }

  async function canStash(cwd: string): Promise<boolean> {
    try {
      await execa('git', ['stash', 'create'], { cwd });
      return true;
    } catch {
      return false;
    }
  }

  it('leaves every commit stashable, so a lint-staged hook can back up its state', async () => {
    const root = await createRepoWithVendoredSkill();

    // Without the split this index is unstashable, which is the bug being fixed.
    await execa('git', ['add', '-A'], { cwd: root });
    expect(await canStash(root)).toBe(false);
    await execa('git', ['reset', '-q'], { cwd: root });

    const result = await commitAllChanges(root, 'install skills', {
      typeChangeMessage: 'remove vendored copies',
    });

    expect(result.committed).toBe(true);
    expect(result.preludeCommit?.committed).toBe(true);
    expect(result.preludeCommit?.message).toBe('remove vendored copies');

    const log = await execa('git', ['log', '--format=%s'], { cwd: root });
    expect(log.stdout.split('\n')).toEqual(['install skills', 'remove vendored copies', 'init']);

    const status = await execa('git', ['status', '--porcelain'], { cwd: root });
    expect(status.stdout).toBe('');
    expect(await canStash(root)).toBe(true);

    // The symlink survives the round trip through the prelude commit.
    const tracked = await execa('git', ['ls-files', '-s', '.claude/skills/foo'], { cwd: root });
    expect(tracked.stdout.startsWith('120000')).toBe(true);

    await rm(root, { recursive: true, force: true });
  });

  it('makes a single commit when no type change is staged', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genx-typechange-'));
    await execa('git', ['init', '-q'], { cwd: root });
    await execa('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
    await execa('git', ['config', 'user.name', 'Test'], { cwd: root });
    await writeFile(join(root, 'a.txt'), 'a\n');

    const result = await commitAllChanges(root, 'add a', { typeChangeMessage: 'unused' });

    expect(result.committed).toBe(true);
    expect(result.preludeCommit).toBeUndefined();

    const log = await execa('git', ['log', '--format=%s'], { cwd: root });
    expect(log.stdout).toBe('add a');

    await rm(root, { recursive: true, force: true });
  });

  it('does not split when the caller has not opted in', async () => {
    const root = await createRepoWithVendoredSkill();

    // No `typeChangeMessage`: the single commit is attempted, exactly as before this option existed.
    const result = await commitAllChanges(root, 'install skills');

    expect(result.committed).toBe(true);
    expect(result.preludeCommit).toBeUndefined();

    const log = await execa('git', ['log', '--format=%s'], { cwd: root });
    expect(log.stdout.split('\n')).toEqual(['install skills', 'init']);

    await rm(root, { recursive: true, force: true });
  });

  it('leaves changes outside the pathspec dirty, split included', async () => {
    // `upgrade` deliberately leaves package.json and .gitignore dirty when the skills install runs
    // at the end. Without a pathspec the sweep files that work under the skills subject.
    const root = await createRepoWithVendoredSkill();
    await writeFile(join(root, 'package.json'), '{ "name": "edited-by-upgrade" }\n');

    const result = await commitAllChanges(root, 'install skills', {
      typeChangeMessage: 'remove vendored copies',
      paths: ['.agents/skills', '.claude/skills'],
    });

    expect(result.committed).toBe(true);
    expect(result.preludeCommit?.committed).toBe(true);

    const status = await execa('git', ['status', '--porcelain'], { cwd: root });
    expect(status.stdout.trim()).toBe('M package.json');

    for (const ref of ['HEAD', 'HEAD~1']) {
      const files = await execa('git', ['show', '--name-only', '--format=', ref], { cwd: root });
      expect(files.stdout).not.toContain('package.json');
    }

    await rm(root, { recursive: true, force: true });
  });
});
