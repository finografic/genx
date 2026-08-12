import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lint } from '@google/design.md/linter';

import { pc } from 'utils/picocolors';

export interface LintResult {
  exitCode: number;
  message: string;
  lines: string[];
  /** Raw report subset for --format json. */
  json: { findings: unknown[]; summary: { errors: number; warnings: number; infos: number } };
}

const SEVERITY_STYLE: Record<string, (s: string) => string> = {
  error: (s) => pc.red(s),
  warning: (s) => pc.yellow(s),
  info: (s) => pc.dim(s),
};

/**
 * `genx design lint` — validate DESIGN.md against the official spec via the
 * `@google/design.md` programmatic linter. Exit 1 when errors are found.
 */
export function runLint(targetDir: string, options: { file?: string }): LintResult {
  const designMdPath = join(targetDir, options.file ?? 'DESIGN.md');
  if (!existsSync(designMdPath)) {
    return {
      exitCode: 1,
      message: `No DESIGN.md found at ${designMdPath}.`,
      lines: [],
      json: { findings: [], summary: { errors: 1, warnings: 0, infos: 0 } },
    };
  }

  const report = lint(readFileSync(designMdPath, 'utf8'));

  const lines = report.findings.map((finding) => {
    const style = SEVERITY_STYLE[finding.severity] ?? ((s: string) => s);
    const path = finding.path ? pc.cyan(`${finding.path}  `) : '';
    return `${style(finding.severity.padEnd(7))} ${path}${finding.message}`;
  });

  const { errors, warnings, infos } = report.summary;
  const summaryText = `${errors} errors · ${warnings} warnings · ${infos} infos`;

  return {
    exitCode: errors > 0 ? 1 : 0,
    message: errors > 0 ? `Lint failed: ${summaryText}` : `Lint passed: ${summaryText}`,
    lines,
    json: { findings: report.findings, summary: report.summary },
  };
}
