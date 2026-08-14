import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { findGitignoreCommentSectionRange } from 'lib/gitignore-section.utils';

const execFileAsync = promisify(execFile);

const SECTION_TITLE = 'Design';

/**
 * Add `pattern` to a `.gitignore`, inside a `# Design` section (created if
 * absent, extended if present). Returns null when the pattern is already
 * listed, so an unchanged file is never rewritten.
 */
export function addGitignorePattern(content: string, pattern: string): string | null {
  const normalized = content.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  if (lines.some((line) => line.trim() === pattern)) {
    return null;
  }

  const range = findGitignoreCommentSectionRange(lines, SECTION_TITLE);
  if (range) {
    let insertAt = range.end;
    // Keep the pattern with its section rather than after its trailing blank lines.
    while (insertAt > range.start + 1 && lines[insertAt - 1]?.trim() === '') {
      insertAt -= 1;
    }
    lines.splice(insertAt, 0, pattern);
    return lines.join('\n');
  }

  const body = normalized.replace(/\n+$/, '');
  return `${body}${body === '' ? '' : '\n\n'}# ${SECTION_TITLE}\n${pattern}\n`;
}

/**
 * Whether git already ignores this path — it may be covered by a broad rule
 * (`*.html`) rather than a literal entry. Falls back to false outside a repo or
 * when git is unavailable, where proposing the entry is the safe default.
 */
export async function isIgnoredByGit(targetDir: string, relativePath: string): Promise<boolean> {
  try {
    await execFileAsync('git', ['check-ignore', '--quiet', '--', relativePath], { cwd: targetDir });
    return true;
  } catch {
    return false;
  }
}
