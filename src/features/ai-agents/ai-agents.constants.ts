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
  'Project Memory Model',
] as const;

/** Legacy H2 sections removed on sync (superseded by Project Memory Model). */
export const AI_AGENTS_REMOVED_SECTION_HEADINGS = [
  'Claude Code — Session Memory and Handoff',
  'Agent Memory Files',
] as const;

/** Normalized keys for {@link AI_AGENTS_REMOVED_SECTION_HEADINGS} (via normalizeHeadingKey). */
export const AI_AGENTS_REMOVED_SECTION_HEADING_KEYS = [
  'claude code - session memory and handoff',
  'agent memory files',
] as const;

/**
 * Front matter blocks read before the Rules spine (project-specific sections preserved; not
 * overwritten when present).
 */
export const AI_AGENTS_FRONT_MATTER_HEADINGS = [
  'New here and require INITIAL CONTEXT ?',
  'Project Memory Model',
  'Roadmap and Planning Docs',
] as const;

export const AI_AGENTS_FRONT_MATTER_HEADING_KEYS = [
  'new here and require initial context ?',
  'project memory model',
  'roadmap and planning docs',
] as const;

/** Shared Rules / Git spine (after front matter). */
export const AI_AGENTS_SPINE_HEADINGS = [
  'Rules — Project-Specific',
  'Rules — Global',
  'Rules — Markdown Tables',
  'Git Policy',
] as const;

export const AI_AGENTS_SPINE_HEADING_KEYS = [
  'rules - project-specific',
  'rules - global',
  'rules - markdown tables',
  'git policy',
] as const;

export const AI_AGENTS_ALL_CANONICAL_HEADINGS = [
  ...AI_AGENTS_FRONT_MATTER_HEADINGS,
  ...AI_AGENTS_SPINE_HEADINGS,
] as const;

/** @deprecated Use {@link AI_AGENTS_REMOVED_SECTION_HEADINGS} */
export const AI_AGENTS_LEGACY_SECTION_HEADING = AI_AGENTS_REMOVED_SECTION_HEADINGS[0];
