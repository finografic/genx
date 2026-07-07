/**
 * AI Memory feature configuration.
 *
 * Project memory model: roadmap, handoff, session memory, and cross-agent compatibility shims.
 */

export const AI_MEMORY_FEATURE_ID = 'aiMemory' as const;

/** Primary files owned or repaired by this feature (relative to targetDir). */
export const AI_MEMORY_FILES = [
  'docs/process/PROJECT_MEMORY_MODEL.md',
  'docs/todo/ROADMAP.md',
  '.agents/handoff.md',
  '.agents/memory.md',
  'CLAUDE.md',
] as const;

/** Legacy paths migrated or replaced during repair. */
export const AI_MEMORY_LEGACY_PATHS = [
  '.claude/memory.md',
  '.claude/handoff.md',
  'docs/todo/NEXT_STEPS.md',
] as const;

/** Paths that should not remain tracked once gitignore rules are applied. */
export const AI_MEMORY_UNTRACK_IF_INDEXED = ['.agents/memory.md', '.claude/memory.md'] as const;
