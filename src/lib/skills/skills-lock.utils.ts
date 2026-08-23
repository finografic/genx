import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileExists } from 'utils';

import { SKILLS_CANONICAL_DIR, SKILLS_CLAUDE_DIR, SKILLS_LOCKFILE } from './skills.constants.js';

/** One installed skill, keyed in the lockfile by its `SKILL.md` frontmatter `name`. */
export interface SkillsLockEntry {
  source?: string;
  sourceType?: string;
  skillPath?: string;
  computedHash?: string;
}

export interface SkillsLock {
  version?: number;
  skills?: Record<string, SkillsLockEntry>;
}

/**
 * What the CLI owns in this repository.
 *
 * - `unmanaged` — no lockfile; skills have not been migrated and genx still dual-writes them.
 * - `incomplete` — a lockfile lists skills that are not on disk (a fresh clone); restore them.
 * - `managed` — every locked skill is present; genx leaves skills alone.
 */
export type SkillsInstallState = 'unmanaged' | 'incomplete' | 'managed';

export interface SkillsStatus {
  state: SkillsInstallState;
  /** Skill names in the lockfile, sorted. */
  locked: string[];
  /** Locked skills with no directory in either container. */
  missing: string[];
}

export function skillsLockPath(targetDir: string): string {
  return resolve(targetDir, SKILLS_LOCKFILE);
}

export function hasSkillsLock(targetDir: string): boolean {
  return fileExists(skillsLockPath(targetDir));
}

/** Read and parse the lockfile. Returns `null` when it is absent or unparseable. */
export async function readSkillsLock(targetDir: string): Promise<SkillsLock | null> {
  if (!hasSkillsLock(targetDir)) return null;

  try {
    return JSON.parse(await readFile(skillsLockPath(targetDir), 'utf8')) as SkillsLock;
  } catch {
    // A corrupt lockfile is still proof that an external manager owns skills here, so callers get
    // an empty lock rather than `null` — treating it as "unmanaged" would restart the dual-write.
    return {};
  }
}

/**
 * Classify what the CLI owns here.
 *
 * Deliberately does **not** recompute `computedHash` to detect drift. That would re-implement the
 * CLI's hashing in a second place, which is the duplication this whole move exists to remove — and
 * it would go stale the first time the CLI changed the algorithm. `skills update` is the authority
 * on drift; genx only reports that an external manager is in charge.
 */
export async function resolveSkillsStatus(targetDir: string): Promise<SkillsStatus> {
  const lock = await readSkillsLock(targetDir);

  if (!lock) {
    return { state: 'unmanaged', locked: [], missing: [] };
  }

  const locked = Object.keys(lock.skills ?? {}).toSorted((a, b) => a.localeCompare(b));
  const missing = locked.filter(
    (name) =>
      !fileExists(resolve(targetDir, SKILLS_CANONICAL_DIR, name)) &&
      !fileExists(resolve(targetDir, SKILLS_CLAUDE_DIR, name)),
  );

  return { state: missing.length > 0 ? 'incomplete' : 'managed', locked, missing };
}
