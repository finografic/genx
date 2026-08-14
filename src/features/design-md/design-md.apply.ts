import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { runPull } from 'commands/design/lib/pull.runner';
import type { FeatureApplyResult, FeatureContext } from '../feature.types';

import { DESIGN_MD_FILE } from './design-md.constants.js';

/**
 * Refresh a drifted DESIGN.md from the design system — the same deterministic
 * `genx design sync --pull`, preview-gated.
 *
 * **Never creates one.** Writing a DESIGN.md from scratch means consolidating
 * inconsistencies and naming design intent: judgement work that belongs to the
 * `generate-design-md` skill, not to an unattended sync that could run across
 * every managed repository at once.
 */
export async function applyDesignMd(context: FeatureContext): Promise<FeatureApplyResult> {
  if (!existsSync(join(context.targetDir, DESIGN_MD_FILE))) {
    return {
      applied: [],
      noopMessage:
        'No DESIGN.md to refresh. Creating one is a judgement task — run the `generate-design-md` ' +
        'skill, then `genx design sync --pull` keeps it current.',
    };
  }

  const result = await runPull(context.targetDir, {
    yes: context.yesAll,
  });

  if (result.status === 'error') {
    return { applied: [], noopMessage: result.message };
  }
  if (result.status === 'applied') {
    return { applied: [DESIGN_MD_FILE], appliedTargetPaths: [join(context.targetDir, DESIGN_MD_FILE)] };
  }
  return { applied: [], noopMessage: result.message };
}
