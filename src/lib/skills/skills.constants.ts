/**
 * Agent Skills CLI constants.
 *
 * Shared `@finografic` skills are distributed by the Agent Skills CLI rather than vendored by genx.
 * See `docs/specs/2026-08-23-skill-distribution-model.md`.
 */

/** Npm package providing the CLI. */
export const SKILLS_CLI_PACKAGE = 'skills';

/**
 * Pinned CLI version.
 *
 * `dlx` resolves `latest` when unpinned, so an upstream release could change what an upgrade writes
 * part-way through a `managed upgrade` sweep. Bump this deliberately, the way `deps-policy` is.
 */
export const SKILLS_CLI_VERSION = '1.5.23';

/**
 * Lockfile the CLI writes. Its presence means an external manager owns this repository's skills, so
 * the `ai-agents` feature must not write them.
 *
 * It is committed: the gate only holds if the file survives a clone, otherwise every fresh checkout
 * looks unmigrated and genx dual-writes real directories over the CLI's symlinks.
 */
export const SKILLS_LOCKFILE = 'skills-lock.json';

/** Repository shared `@finografic` skills are published from. */
export const SHARED_SKILLS_SOURCE = 'finografic/ai-skills';

/**
 * Agents to install to, in order.
 *
 * `universal` owns `.agents/skills/<name>` as the canonical real copy; `claude-code` symlinks
 * `.claude/skills/<name>` at it. Both are required — verified 2026-08-24, installing to
 * `claude-code` alone writes real directories into `.claude/skills/` and creates no `.agents/`
 * copy at all, which is exactly the duplication this move exists to remove.
 *
 * The CLI rejects a comma-separated list, so these are passed as repeated `--agent` flags.
 */
export const SKILLS_CLI_AGENTS = ['universal', 'claude-code'] as const;

/** Canonical skill directory (`universal`), relative to the target. */
export const SKILLS_CANONICAL_DIR = '.agents/skills';

/** Claude Code skill directory (`claude-code`), symlinked at the canonical copy. */
export const SKILLS_CLAUDE_DIR = '.claude/skills';
