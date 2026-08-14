/**
 * Raw (unresolved) DESIGN.md token model, as authored in YAML frontmatter.
 * Values stay strings/numbers exactly as written — token references like
 * `{colors.primary}` are preserved, not resolved. Resolution/validation is
 * delegated to `@google/design.md` (see the `lint` runner).
 */

export interface RawTypographyToken {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: number | string;
  lineHeight?: number | string;
  letterSpacing?: string;
  fontFeature?: string;
  fontVariation?: string;
}

export interface RawDesignTokens {
  'version'?: string;
  'name'?: string;
  'description'?: string;
  /** Custom extension key — declares which side owns the tokens. */
  'source-of-truth'?: SourceOfTruth;
  'colors'?: Record<string, string>;
  'typography'?: Record<string, RawTypographyToken>;
  'rounded'?: Record<string, string>;
  'spacing'?: Record<string, string | number>;
  'components'?: Record<string, Record<string, string>>;
}

/** Token groups that sync/check operate on, in canonical serialization order. */
export const TOKEN_GROUPS = ['colors', 'typography', 'rounded', 'spacing', 'components'] as const;
export type TokenGroup = (typeof TOKEN_GROUPS)[number];

export type SourceOfTruth = 'design-system' | 'design-md';

export interface ParsedDesignMd {
  tokens: RawDesignTokens;
  /** Markdown body after the closing frontmatter fence (leading newline trimmed). */
  body: string;
  hasFrontmatter: boolean;
}

/* ────────────────────────────────────────────────────────── */
/* Extraction                                                 */
/* ────────────────────────────────────────────────────────── */

export type DesignSystemFramework = 'pandacss' | 'tailwind4';

export interface DetectedDesignSystem {
  framework: DesignSystemFramework;
  /** Files the tokens were (or will be) read from, relative to the target dir. */
  sourceFiles: string[];
}

export interface ExtractedTokens {
  framework: DesignSystemFramework;
  sourceFiles: string[];
  tokens: Pick<RawDesignTokens, TokenGroup>;
  /** Non-fatal extraction notes (e.g. a preset referenced by name, left unresolved). */
  warnings?: string[];
  /**
   * Count of tokens the design system also defines a dark value for. The spec has
   * no theme concept, so only the base palette is mirrored — this records what was
   * deliberately left behind rather than dropping it silently.
   */
  darkTokenCount?: number;
}

/* ────────────────────────────────────────────────────────── */
/* Drift comparison                                           */
/* ────────────────────────────────────────────────────────── */

export interface GroupDrift {
  added: string[];
  removed: string[];
  modified: Array<{ token: string; current: string; expected: string }>;
}

export interface DriftReport {
  /** Only groups the extractor produced are compared. */
  groups: Partial<Record<TokenGroup, GroupDrift>>;
  hasDrift: boolean;
}
