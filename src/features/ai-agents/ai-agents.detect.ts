import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileExists } from 'utils';
import type { FeatureContext } from '../feature.types';

import { hasSection, parseSections } from 'lib/markdown-sections';
import { AI_AGENTS_ENFORCED_HEADINGS } from './ai-agents.constants';

/**
 * Detect whether the ai-agents layer is installed.
 *
 * Returns `true` when `AGENTS.md` exists and all enforced canonical sections
 * are present. Does not check whether the section bodies match the template —
 * that comparison is part of `apply`.
 */
export async function detectAiAgents(context: FeatureContext): Promise<boolean> {
  const agentsPath = resolve(context.targetDir, 'AGENTS.md');

  if (!fileExists(agentsPath)) return false;

  const content = await readFile(agentsPath, 'utf8');
  const parsed = parseSections(content);

  return AI_AGENTS_ENFORCED_HEADINGS.every((h) => hasSection(parsed, h));
}
