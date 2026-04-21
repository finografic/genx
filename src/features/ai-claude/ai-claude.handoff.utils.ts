/**
 * Merge legacy `.claude/handoff.md` into a new `.ai/handoff.md` when adopting the template layout.
 */

/**
 * Strip a single leading Markdown H1 (first line `# ...`) and following blank lines.
 */
export function stripLeadingMarkdownH1(content: string): string {
  const trimmed = content.replace(/^\uFEFF?/, '');
  const lines = trimmed.split(/\r?\n/);
  if (lines.length === 0) {
    return content;
  }
  if (!lines[0]!.startsWith('# ')) {
    return content;
  }
  let i = 1;
  while (i < lines.length && lines[i]!.trim() === '') {
    i++;
  }
  return lines.slice(i).join('\n');
}

/**
 * Templated `.ai/handoff.md` body plus legacy Claude handoff content under a clear heading (dedupe H1).
 */
export function appendMigratedClaudeHandoff(templatedAiHandoff: string, claudeHandoffRaw: string): string {
  const body = stripLeadingMarkdownH1(claudeHandoffRaw).trimEnd();
  if (body === '') {
    return templatedAiHandoff.endsWith('\n') ? templatedAiHandoff : `${templatedAiHandoff}\n`;
  }
  const base = templatedAiHandoff.trimEnd();
  return `${base}\n\n---\n\n## Imported from \`.claude/handoff.md\`\n\n${body}\n`;
}
