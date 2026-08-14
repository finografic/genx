import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { runCheck } from 'commands/design/lib/check.runner';
import type { AuditResult, FeatureContext } from '../feature.types';

import { detectDesignSystems } from 'lib/design-md/extractors/detect';

import { DESIGN_MD_FILE } from './design-md.constants.js';

function designMdPath(targetDir: string): string {
  return join(targetDir, DESIGN_MD_FILE);
}

/**
 * The token mirror only makes sense where there is something to mirror, or a
 * DESIGN.md already exists. Elsewhere the feature is omitted from the audit
 * rather than reported missing — most packages have no design system, and a
 * permanent red entry is noise, not a finding.
 */
export function isDesignMdApplicable(context: FeatureContext): boolean {
  return existsSync(designMdPath(context.targetDir)) || detectDesignSystems(context.targetDir).length > 0;
}

export function detectDesignMd(context: FeatureContext): boolean {
  return existsSync(designMdPath(context.targetDir));
}

/**
 * Detection only: reports whether DESIGN.md exists and whether its tokens still
 * match the design system (`design check` under the hood). Never writes.
 */
export async function auditDesignMd(context: FeatureContext): Promise<AuditResult> {
  if (!existsSync(designMdPath(context.targetDir))) {
    return { status: 'missing', detail: 'no DESIGN.md — generate one with the generate-design-md skill' };
  }

  const result = await runCheck(context.targetDir, {});
  if (result.exitCode === 0) {
    return { status: 'installed' };
  }
  return { status: 'partial', detail: 'DESIGN.md tokens out of date' };
}
