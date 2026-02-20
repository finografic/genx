import type { Feature } from '../feature.types';
import { applyAiClaude } from './ai-claude.apply';
import { detectAiClaude } from './ai-claude.detect';

/**
 * AI Claude feature definition.
 * Installs Claude Code support: CLAUDE.md, session memory, handoff doc, and settings.
 */
export const aiClaudeFeature: Feature = {
  id: 'aiClaude',
  label: 'Claude Code (CLAUDE.md, session memory, handoff)',
  hint: 'recommended',
  detect: detectAiClaude,
  apply: applyAiClaude,
};
