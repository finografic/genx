/**
 * AI Instructions feature configuration.
 *
 * Installs GitHub Copilot's stub instructions file (`.github/copilot-instructions.md`, the only
 * place Copilot itself reads from) and the shared, cross-tool `.agents/instructions/`.
 */

export const AI_INSTRUCTIONS_FILES = ['.github/copilot-instructions.md', '.agents/instructions'] as const;

/** Cursor always-on agent rules (`.mdc` files). */
export const AI_INSTRUCTIONS_CURSOR_RULES_DIR = '.cursor/rules' as const;

/**
 * Target package `AGENTS.md` path; merge reads `_templates/AGENTS.md.template` (canonical spine, not any
 * repo’s hand-edited copy).
 */
export const AI_INSTRUCTIONS_AGENTS_MD = 'AGENTS.md' as const;

/**
 * Which subtrees under `.agents/instructions/` are consumer-owned is no longer hardcoded here — it
 * comes from the `exclude` and `ownership` fields of the `@finografic/ai-agent-config` manifest.
 * See `lib/agent-assets` and that package's distribution contract.
 */
