/**
 * Locate a top-level `# Title` section in a `.gitignore`-style line array.
 *
 * Sections are bounded by headers: a line matching `# …` where the text after `#` begins with a letter
 * (so `# !foo` and pattern lines do not start a new section).
 */
export function findGitignoreCommentSectionRange(
  lines: readonly string[],
  sectionTitle: string,
): { start: number; end: number } | null {
  const escaped = sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const headerRe = new RegExp(`^#\\s*${escaped}\\s*$`, 'i');
  const start = lines.findIndex((l) => headerRe.test(l.trimEnd()));
  if (start === -1) return null;

  let end = start + 1;
  while (end < lines.length) {
    const line = lines[end];
    if (line.startsWith('#')) {
      const afterHash = line.slice(line.indexOf('#') + 1).trim();
      if (afterHash.length > 0 && /^[A-Za-z]/.test(afterHash)) {
        break;
      }
    }
    end++;
  }
  return { start, end };
}
