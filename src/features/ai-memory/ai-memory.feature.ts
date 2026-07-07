import type { Feature } from '../feature.types';

import { applyAiMemory } from './ai-memory.apply';
import { auditAiMemory, detectAiMemory } from './ai-memory.detect';

/**
 * AI Memory feature definition. Project memory model: roadmap, handoff, session memory,
 * and cross-agent compatibility shims.
 */
export const aiMemoryFeature: Feature = {
  id: 'aiMemory',
  label: 'AI Memory (roadmap, handoff, session memory)',
  hint: 'recommended',
  detect: detectAiMemory,
  audit: auditAiMemory,
  apply: applyAiMemory,
};
