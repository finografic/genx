import { execa } from 'execa';

/** Where a generation run should take the starter from. */
export type MonorepoSource =
  | { kind: 'tag'; tag: string; origin: SourceOrigin }
  | { kind: 'local'; path: string };

/** Which layer supplied the resolved tag — surfaced to the user so the choice is never silent. */
export type SourceOrigin = 'flag' | 'flag-latest' | 'config' | 'pinned';

/** Literal accepted by `--tag` to resolve the newest remote tag instead of a fixed one. */
export const LATEST_TAG_KEYWORD = 'latest';

const SEMVER_TAG = /^v(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/;

/**
 * Compare two `vX.Y.Z` tags numerically.
 *
 * Lexical comparison gets this wrong in the way that matters — it ranks `v0.9.0` above `v0.10.0` —
 * so the newest-tag lookup must sort on parsed components. Tags that do not parse sort last and
 * are never selected as newest.
 *
 * @returns Negative when `a` precedes `b`, positive when `a` follows `b`.
 */
export function compareSemverTags(a: string, b: string): number {
  const left = SEMVER_TAG.exec(a);
  const right = SEMVER_TAG.exec(b);

  if (!left || !right) {
    if (left) return -1;
    if (right) return 1;
    return a.localeCompare(b);
  }

  for (let i = 1; i <= 3; i++) {
    const diff = Number(left[i]) - Number(right[i]);
    if (diff !== 0) return diff;
  }

  // A prerelease precedes its release (v1.0.0-rc.1 < v1.0.0).
  const leftPre = left[4];
  const rightPre = right[4];
  if (leftPre && !rightPre) return -1;
  if (!leftPre && rightPre) return 1;
  if (leftPre && rightPre) return leftPre.localeCompare(rightPre);

  return 0;
}

/** Parse `git ls-remote --tags` output into tag names, discarding `^{}` dereference lines. */
export function parseRemoteTags(stdout: string): string[] {
  const tags: string[] = [];

  for (const line of stdout.split('\n')) {
    const match = /refs\/tags\/(.+)$/.exec(line.trim());
    const tag = match?.[1];
    if (tag && !tag.endsWith('^{}')) {
      tags.push(tag);
    }
  }

  return tags;
}

/** List every tag on the remote, newest last. */
export async function listRemoteTags(repoUrl: string): Promise<string[]> {
  try {
    const { stdout } = await execa('git', ['ls-remote', '--tags', repoUrl]);
    return parseRemoteTags(stdout).toSorted(compareSemverTags);
  } catch (error) {
    throw new Error(
      [
        `Failed to list tags on ${repoUrl}.`,
        'Check network access and that your SSH key can reach the repository.',
        '',
        error instanceof Error ? error.message : String(error),
      ].join('\n'),
      { cause: error },
    );
  }
}

/** Resolve the newest semver tag on the remote. */
export async function resolveLatestRemoteTag(repoUrl: string): Promise<string> {
  const tags = await listRemoteTags(repoUrl);
  const latest = tags.at(-1);

  if (!latest) {
    throw new Error(`No tags found on ${repoUrl}. Create one before generating from "latest".`);
  }

  return latest;
}

export interface ResolveMonorepoSourceOptions {
  /** Value of `--tag`, if passed. `latest` resolves the newest remote tag. */
  tagFlag?: string;
  /** `monorepoStarter` block from `genx.config.jsonc`, if present. */
  configTag?: string;
  configPath?: string;
  /** Tag pinned in this genx release — the reproducible default. */
  pinnedTag: string;
  repoUrl: string;
}

/**
 * Decide where the starter comes from.
 *
 * Precedence, highest first: `--tag` → config `tag` → the release pin. A configured local `path`
 * wins over all of them but is still overridden by an explicit `--tag`, so a one-off flag can
 * always get back to a clean tagged source without editing config.
 */
export async function resolveMonorepoSource({
  tagFlag,
  configTag,
  configPath,
  pinnedTag,
  repoUrl,
}: ResolveMonorepoSourceOptions): Promise<MonorepoSource> {
  if (tagFlag === LATEST_TAG_KEYWORD) {
    return { kind: 'tag', tag: await resolveLatestRemoteTag(repoUrl), origin: 'flag-latest' };
  }

  if (tagFlag) {
    return { kind: 'tag', tag: tagFlag, origin: 'flag' };
  }

  if (configPath) {
    return { kind: 'local', path: configPath };
  }

  if (configTag) {
    return { kind: 'tag', tag: configTag, origin: 'config' };
  }

  return { kind: 'tag', tag: pinnedTag, origin: 'pinned' };
}

/** Human-readable description of a resolved source, for the generation log. */
export function describeMonorepoSource(source: MonorepoSource): string {
  if (source.kind === 'local') {
    return `local checkout ${source.path} (including uncommitted changes)`;
  }

  const suffix = {
    'flag': ' (--tag)',
    'flag-latest': ' (--tag latest)',
    'config': ' (genx.config.jsonc)',
    'pinned': '',
  }[source.origin];

  return `tag ${source.tag}${suffix}`;
}
