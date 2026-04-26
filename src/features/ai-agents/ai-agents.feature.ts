import type { Feature } from '../feature.types';

import { applyAiAgents } from './ai-agents.apply';
import { auditAiAgents, detectAiAgents } from './ai-agents.detect';

export const aiAgentsFeature: Feature = {
  id: 'aiAgents',
  label: 'AI Agents (AGENTS.md + skills)',
  hint: undefined,
  detect: detectAiAgents,
  audit: auditAiAgents,
  apply: applyAiAgents,
};
