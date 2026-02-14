import type { Feature } from '../feature.types';
import { applyAiInstructions } from './ai-instructions.apply';
import { detectAiInstructions } from './ai-instructions.detect';

/**
 * AI Instructions feature definition.
 * Installs shared .github/instructions/, Copilot instructions, and Cursor rules.
 */
export const aiInstructionsFeature: Feature = {
  id: 'aiInstructions',
  label: 'AI Instructions (Copilot, Cursor rules)',
  hint: 'recommended',
  detect: detectAiInstructions,
  apply: applyAiInstructions,
};
