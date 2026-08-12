import type {
  DriftReport,
  ExtractedTokens,
  GroupDrift,
  RawDesignTokens,
  TokenGroup,
} from './design-md.types.js';

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    // Stable stringify for composite tokens (typography, components).
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .toSorted(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${normalizeValue(v)}`);
    return `{${entries.join(',')}}`;
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value) ?? '';
}

function compareGroup(
  current: Record<string, unknown> | undefined,
  expected: Record<string, unknown> | undefined,
): GroupDrift {
  const drift: GroupDrift = { added: [], removed: [], modified: [] };
  const currentMap = current ?? {};
  const expectedMap = expected ?? {};

  for (const token of Object.keys(expectedMap)) {
    if (!(token in currentMap)) {
      drift.added.push(token);
    } else if (normalizeValue(currentMap[token]) !== normalizeValue(expectedMap[token])) {
      drift.modified.push({
        token,
        current: normalizeValue(currentMap[token]),
        expected: normalizeValue(expectedMap[token]),
      });
    }
  }
  for (const token of Object.keys(currentMap)) {
    if (!(token in expectedMap)) {
      drift.removed.push(token);
    }
  }
  return drift;
}

/**
 * Compare the tokens currently in DESIGN.md against freshly extracted tokens.
 * Only groups the extractor produced are compared — DESIGN.md may legitimately
 * hold groups (e.g. `components`) that a framework extractor does not emit.
 *
 * Direction: `added` = in the design system but missing from DESIGN.md;
 * `removed` = in DESIGN.md but no longer in the design system.
 */
export function compareTokens(current: RawDesignTokens, extracted: ExtractedTokens): DriftReport {
  const report: DriftReport = { groups: {}, hasDrift: false };
  const currentRecord = current as Record<TokenGroup, Record<string, unknown> | undefined>;

  for (const [group, expected] of Object.entries(extracted.tokens) as Array<
    [TokenGroup, Record<string, unknown> | undefined]
  >) {
    if (!expected || Object.keys(expected).length === 0) {
      continue;
    }
    const drift = compareGroup(currentRecord[group], expected);
    report.groups[group] = drift;
    if (drift.added.length > 0 || drift.removed.length > 0 || drift.modified.length > 0) {
      report.hasDrift = true;
    }
  }
  return report;
}
