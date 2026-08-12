import type { ParsedDesignMd, SourceOfTruth } from './design-md.types.js';

/**
 * Resolve which side owns the tokens, per the adaptive/hybrid convention:
 *
 * 1. Explicit `source-of-truth:` frontmatter key wins (custom extension key — the spec accepts and preserves
 *    unknown keys).
 * 2. Otherwise the prose `## Source of Truth` section is read heuristically.
 * 3. Otherwise: if a design system was detected in the project, it is assumed canonical (`design-system`); with
 *    no design system, DESIGN.md itself is.
 */
export function resolveSourceOfTruth(
  parsed: ParsedDesignMd,
  options: { designSystemDetected: boolean },
): SourceOfTruth {
  const explicit = parsed.tokens['source-of-truth'];
  if (explicit === 'design-system' || explicit === 'design-md') {
    return explicit;
  }

  const sections = parsed.body.split(/^(?=##\s)/m);
  const section = sections.find((s) => /^##\s+source of truth\b/i.test(s));
  if (section) {
    const text = section.toLowerCase();
    if (
      /this\s+(file|design\.?md)[^.]*\bcanonical/.test(text) ||
      /design\.?md\s+is\s+the\s+canonical/.test(text)
    ) {
      return 'design-md';
    }
    if (/\bcanonical\b/.test(text)) {
      return 'design-system';
    }
  }

  return options.designSystemDetected ? 'design-system' : 'design-md';
}
