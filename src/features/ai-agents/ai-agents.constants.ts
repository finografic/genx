/**
 * Ai-agents feature constants.
 */

/** Paths created/managed by this feature (relative to targetDir). */
export const AI_AGENTS_FILES = ['AGENTS.md', '.github/skills/'] as const;

/** Directory where agent skill procedures are scaffolded. */
export const AI_AGENTS_SKILLS_DIR = '.github/skills';

/**
 * Canonical H2 section headings defined in `_templates/AGENTS.md.template`.
 * Applied to every target project — split into two tiers:
 *
 * SEEDED   — written once if absent; never updated automatically (project customises them).
 * ENFORCED — written if absent AND updated when the body diverges from the template.
 */
export const AI_AGENTS_SEEDED_HEADINGS = ['Rules — Project-Specific'] as const;

export const AI_AGENTS_ENFORCED_HEADINGS = [
  'Rules — Global',
  'Rules — Markdown Tables',
  'Git Policy',
] as const;

export const AI_AGENTS_ALL_CANONICAL_HEADINGS = [
  ...AI_AGENTS_SEEDED_HEADINGS,
  ...AI_AGENTS_ENFORCED_HEADINGS,
] as const;
