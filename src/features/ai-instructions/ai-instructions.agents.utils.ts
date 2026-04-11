/**
 * Sync the canonical "## Rules — General" block in AGENTS.md from `_templates/AGENTS.md`.
 * Preserves other sections (Skills, Learned, Project-Specific, etc.).
 */

const RULES_GENERAL_HEADING = '## Rules — General';
const RULES_MARKDOWN_TABLES_HEADING = '## Rules — Markdown Tables';

/**
 * Extract the Rules — General section (from its heading through the line before Rules — Markdown Tables).
 */
export function extractRulesGeneralSection(agentsContent: string): string | null {
  const start = agentsContent.indexOf(RULES_GENERAL_HEADING);
  if (start === -1) return null;
  const end = agentsContent.indexOf(RULES_MARKDOWN_TABLES_HEADING, start + RULES_GENERAL_HEADING.length);
  if (end === -1) return null;
  return agentsContent.slice(start, end).trimEnd();
}

/**
 * Replace or insert the Rules — General block so it matches `newSection` (full block including heading).
 * Returns `null` if the file already matches.
 */
export function proposeAgentsWithRulesGeneralBlock(current: string, newSection: string): string | null {
  const normalizedNew = newSection.trimEnd();
  const existing = extractRulesGeneralSection(current);
  if (existing !== null && existing === normalizedNew) {
    return null;
  }

  const blockRe = /## Rules — General\r?\n[\s\S]*?(?=\r?\n## Rules — Markdown Tables)/;
  if (blockRe.test(current)) {
    const next = current.replace(blockRe, normalizedNew);
    return ensureTrailingNewline(next);
  }

  const insertBeforeMd = /(\r?\n)(## Rules — Markdown Tables)/;
  if (insertBeforeMd.test(current)) {
    const next = current.replace(insertBeforeMd, `\n\n${normalizedNew}\n$1$2`);
    return ensureTrailingNewline(next);
  }

  if (current.trim() === '') {
    return `${normalizedNew}\n\n${RULES_MARKDOWN_TABLES_HEADING}\n\n`;
  }

  return ensureTrailingNewline(`${current.trimEnd()}\n\n${normalizedNew}\n\n`);
}

function ensureTrailingNewline(s: string): string {
  return s.endsWith('\n') ? s : `${s}\n`;
}
