import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { compareTokens } from 'lib/design-md/compare';
import type { DesignSystemFramework, DriftReport } from 'lib/design-md/design-md.types';
import { extractFromProject } from 'lib/design-md/extract';
import { parseDesignMd } from 'lib/design-md/parse';
import { pc } from 'utils/picocolors';

export interface CheckResult {
  exitCode: number;
  report?: DriftReport;
  message: string;
  /** Pre-rendered text lines for drift details (empty for json format callers). */
  lines: string[];
}

/**
 * `genx design check` — drift guard. Re-extracts tokens from the canonical
 * design system in-memory and compares them with the DESIGN.md frontmatter.
 * Exit 1 on drift (CI-able), 0 when in sync.
 */
export async function runCheck(
  targetDir: string,
  options: { framework?: DesignSystemFramework; file?: string },
): Promise<CheckResult> {
  const designMdPath = join(targetDir, options.file ?? 'DESIGN.md');
  if (!existsSync(designMdPath)) {
    return {
      exitCode: 1,
      message: 'No DESIGN.md found. Create one with `genx design sync --pull`.',
      lines: [],
    };
  }

  const extraction = await extractFromProject(targetDir, { framework: options.framework });
  if (!extraction) {
    return {
      exitCode: 0,
      message:
        'No supported design system detected — DESIGN.md is the canonical source; nothing to check against.',
      lines: [],
    };
  }

  const parsed = parseDesignMd(readFileSync(designMdPath, 'utf8'));
  const report = compareTokens(parsed.tokens, extraction.extracted);

  if (!report.hasDrift) {
    return {
      exitCode: 0,
      report,
      message: `DESIGN.md is in sync with ${extraction.extracted.framework}.`,
      lines: [],
    };
  }

  const lines: string[] = [];
  for (const [group, drift] of Object.entries(report.groups)) {
    if (drift.added.length === 0 && drift.removed.length === 0 && drift.modified.length === 0) {
      continue;
    }
    lines.push(pc.bold(group));
    for (const token of drift.added) {
      lines.push(`  ${pc.green('+')} ${token} ${pc.dim('(in design system, missing from DESIGN.md)')}`);
    }
    for (const token of drift.removed) {
      lines.push(`  ${pc.red('-')} ${token} ${pc.dim('(in DESIGN.md, gone from design system)')}`);
    }
    for (const change of drift.modified) {
      lines.push(
        `  ${pc.yellow('~')} ${change.token}: ${pc.red(change.current)} → ${pc.green(change.expected)}`,
      );
    }
  }

  return {
    exitCode: 1,
    report,
    message: `Token drift detected against ${extraction.extracted.framework}. Refresh with \`genx design sync --pull\`.`,
    lines,
  };
}
