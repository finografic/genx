import { describe, expect, it } from 'vitest';

import {
  compareSemverTags,
  describeMonorepoSource,
  parseRemoteTags,
  resolveMonorepoSource,
} from './monorepo.source';

const repoUrl = 'git@github.com:finografic/monorepo-starter.git';
const pinnedTag = 'v0.2.1';

describe('compareSemverTags', () => {
  it('orders by numeric component, not lexically', () => {
    // The case that makes lexical sorting wrong.
    expect(compareSemverTags('v0.9.0', 'v0.10.0')).toBeLessThan(0);
    expect(['v0.10.0', 'v0.9.0', 'v0.2.1'].toSorted(compareSemverTags)).toEqual([
      'v0.2.1',
      'v0.9.0',
      'v0.10.0',
    ]);
  });

  it('orders major, minor and patch', () => {
    expect(compareSemverTags('v1.0.0', 'v2.0.0')).toBeLessThan(0);
    expect(compareSemverTags('v1.2.0', 'v1.10.0')).toBeLessThan(0);
    expect(compareSemverTags('v1.0.2', 'v1.0.10')).toBeLessThan(0);
    expect(compareSemverTags('v1.2.3', 'v1.2.3')).toBe(0);
  });

  it('ranks a prerelease below its release', () => {
    expect(compareSemverTags('v1.0.0-rc.1', 'v1.0.0')).toBeLessThan(0);
    expect(compareSemverTags('v1.0.0', 'v1.0.0-rc.1')).toBeGreaterThan(0);
  });

  it('sorts unparseable tags last so they are never picked as newest', () => {
    const sorted = ['nightly', 'v1.0.0', 'release-2'].toSorted(compareSemverTags);

    expect(sorted.at(-1)).not.toBe('v1.0.0');
    expect(sorted[0]).toBe('v1.0.0');
  });
});

describe('parseRemoteTags', () => {
  it('extracts tag names and drops dereference lines', () => {
    const stdout = [
      '6524e6cc\trefs/tags/v0.1.0',
      'b069537e\trefs/tags/v0.2.0',
      'b069537e\trefs/tags/v0.2.0^{}',
      '43809afa\trefs/tags/v0.2.1',
    ].join('\n');

    expect(parseRemoteTags(stdout)).toEqual(['v0.1.0', 'v0.2.0', 'v0.2.1']);
  });

  it('returns an empty list for empty output', () => {
    expect(parseRemoteTags('')).toEqual([]);
  });
});

describe('resolveMonorepoSource', () => {
  it('falls back to the release pin when the remote cannot be reached', async () => {
    // Unreachable remote: nothing configured, so resolution reaches the network and fails.
    await expect(
      resolveMonorepoSource({ pinnedTag, repoUrl: 'git@example.invalid:nope/nope.git' }),
    ).resolves.toEqual({ tag: 'v0.2.1', origin: 'pinned-fallback' });
  });

  it('prefers a configured tag over reaching the remote', async () => {
    await expect(resolveMonorepoSource({ configTag: 'v0.3.0', pinnedTag, repoUrl })).resolves.toEqual({
      tag: 'v0.3.0',
      origin: 'config',
    });
  });

  it('prefers a prerelease tag when asked for one', async () => {
    // Trying unreleased starter changes goes through the same path: tag a prerelease.
    await expect(resolveMonorepoSource({ tagFlag: 'v0.3.0-rc.1', pinnedTag, repoUrl })).resolves.toEqual({
      tag: 'v0.3.0-rc.1',
      origin: 'flag',
    });
  });

  it('prefers --tag over a configured tag', async () => {
    await expect(
      resolveMonorepoSource({ tagFlag: 'v0.9.9', configTag: 'v0.3.0', pinnedTag, repoUrl }),
    ).resolves.toEqual({ tag: 'v0.9.9', origin: 'flag' });
  });
});

describe('describeMonorepoSource', () => {
  it('names the layer that supplied the tag', () => {
    expect(describeMonorepoSource({ tag: 'v0.2.2', origin: 'latest' })).toBe('tag v0.2.2 (newest on remote)');
    expect(describeMonorepoSource({ tag: 'v0.3.0', origin: 'config' })).toBe(
      'tag v0.3.0 (genx.config.jsonc)',
    );
    expect(describeMonorepoSource({ tag: 'v0.9.9', origin: 'flag' })).toBe('tag v0.9.9 (--tag)');
    expect(describeMonorepoSource({ tag: 'v1.0.0', origin: 'flag-latest' })).toBe(
      'tag v1.0.0 (--tag latest)',
    );
  });

  it('says out loud when a stale pin was used because the remote was unreachable', () => {
    // The fallback must never look like a deliberate choice — that is the whole reason it is named.
    expect(describeMonorepoSource({ tag: 'v0.2.2', origin: 'pinned-fallback' })).toBe(
      "tag v0.2.2 (remote unreachable — falling back to this release's pin)",
    );
  });
});
