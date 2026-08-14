import { join } from 'node:path';
import { createJiti } from 'jiti';
import type { ExtractedTokens, RawTypographyToken } from '../design-md.types.js';

import { normalizeDimension, resolveColorMix } from '../color-value.utils.js';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Panda's `DEFAULT` key means "the group itself" — `colors.primary.DEFAULT` is
 * what `colors.primary` resolves to. DESIGN.md has no such convention, so the
 * segment is dropped. Without this the spec's `primary` colour appears as
 * `primary-DEFAULT` and the linter reports no primary at all.
 */
function stripDefaultSegment(name: string): string {
  return name === 'DEFAULT' ? '' : name.replace(/-DEFAULT$/, '');
}

/**
 * Rewrite Panda token references to flattened DESIGN.md names:
 * `{colors.brand.500}` → `{colors.brand-500}` (group prefix kept, path joined).
 */
function normalizeRefs(value: string): string {
  return value.replace(/\{(\w+)\.([^}]+)\}/g, (_m, group: string, path: string) => {
    return `{${group}.${stripDefaultSegment(path.split('.').join('-'))}}`;
  });
}

/**
 * Panda token values are `{ value: X }` leaves in an arbitrarily nested tree;
 * semantic tokens may wrap conditions: `{ value: { base: X, _dark: Y } }`.
 * Flatten to `path-joined-name → base value`. `transform` adapts the raw value
 * to what the DESIGN.md spec accepts for that token group.
 */
function flattenTokenGroup(group: unknown, transform?: (value: string) => string): Record<string, string> {
  const result: Record<string, string> = {};

  function visit(node: unknown, path: string[]): void {
    if (!isRecord(node)) {
      return;
    }
    if ('value' in node) {
      let raw = node.value;
      if (isRecord(raw)) {
        raw = raw.base ?? Object.values(raw)[0];
      }
      const name = stripDefaultSegment(path.join('-'));
      if ((typeof raw === 'string' || typeof raw === 'number') && name !== '') {
        const normalized = normalizeRefs(String(raw));
        result[name] = transform ? transform(normalized) : normalized;
      }
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      visit(child, [...path, key]);
    }
  }

  visit(group, []);
  return result;
}

/** TextStyles leaves are `{ value: { fontSize, fontWeight, ... } }`. */
function flattenTextStyles(group: unknown): Record<string, RawTypographyToken> {
  const result: Record<string, RawTypographyToken> = {};
  const KNOWN = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing'] as const;

  function visit(node: unknown, path: string[]): void {
    if (!isRecord(node)) {
      return;
    }
    if ('value' in node && isRecord(node.value)) {
      const style: RawTypographyToken = {};
      for (const prop of KNOWN) {
        const raw = node.value[prop];
        if (typeof raw === 'string' || typeof raw === 'number') {
          (style as UnknownRecord)[prop] = raw;
        }
      }
      if (Object.keys(style).length > 0) {
        result[path.join('-')] = style;
      }
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      visit(child, [...path, key]);
    }
  }

  visit(group, []);
  return result;
}

/**
 * Count leaves whose value is a condition map carrying a dark variant
 * (`{ value: { base: X, _dark: Y } }`). Only `base` reaches DESIGN.md.
 */
function countDarkConditions(group: unknown): number {
  let count = 0;

  function visit(node: unknown): void {
    if (!isRecord(node)) {
      return;
    }
    if ('value' in node) {
      const raw = node.value;
      if (isRecord(raw) && Object.keys(raw).some((key) => key.startsWith('_dark'))) {
        count += 1;
      }
      return;
    }
    for (const child of Object.values(node)) {
      visit(child);
    }
  }

  visit(group);
  return count;
}

/** Read a theme key, merging `theme.extend.<key>` over `theme.<key>`. */
function themeKey(theme: UnknownRecord, key: string): unknown {
  const extend = isRecord(theme.extend) ? theme.extend : {};
  const direct = theme[key];
  const extended = extend[key];
  if (isRecord(direct) && isRecord(extended)) {
    return { ...direct, ...extended };
  }
  return extended ?? direct;
}

interface CollectedThemes {
  /** Ascending precedence — later entries override earlier ones. */
  themes: UnknownRecord[];
  /** Presets referenced by package name, which are not resolved (see below). */
  skippedPresets: string[];
}

/**
 * Panda merges `presets` into the config theme, so a project whose tokens live
 * entirely in a preset has an empty top-level `theme`. Walk presets depth-first
 * (nested presets first, then the preset's own theme, then the owner's theme)
 * to produce themes in ascending precedence.
 *
 * String presets — `'@pandacss/preset-panda'`, a workspace package name — are
 * deliberately **not** resolved. Panda's built-in presets carry a large default
 * palette that is not a statement of this project's design intent, and mirroring
 * it into DESIGN.md would bury the project's own tokens. Projects consuming a
 * shared design system import the preset as a value, which is handled.
 */
function collectThemes(config: UnknownRecord): CollectedThemes {
  const themes: UnknownRecord[] = [];
  const skippedPresets: string[] = [];
  const seen = new Set<UnknownRecord>();

  function visit(node: UnknownRecord): void {
    if (seen.has(node)) {
      return;
    }
    seen.add(node);

    if (Array.isArray(node.presets)) {
      for (const preset of node.presets) {
        if (typeof preset === 'string') {
          skippedPresets.push(preset);
        } else if (isRecord(preset)) {
          visit(preset);
        }
      }
    }
    if (isRecord(node.theme)) {
      themes.push(node.theme);
    }
  }

  visit(config);
  return { themes, skippedPresets };
}

/**
 * Extract DESIGN.md tokens from a `panda.config.*`. The config is loaded with
 * jiti (runtime TS support, resolution against the target project's own
 * node_modules), then `theme.tokens` / `theme.semanticTokens` / `theme.textStyles`
 * are mapped — across the config's own theme and any object `presets` it
 * composes. Panda `recipes` → `components` mapping is deliberately not
 * attempted yet — recipe structure is too far from the spec's flat component
 * sub-tokens to map mechanically.
 */
export async function extractPandacssTokens(targetDir: string, configFile: string): Promise<ExtractedTokens> {
  const jiti = createJiti(join(targetDir, 'noop.js'), { interopDefault: true });
  const loaded = await jiti.import(join(targetDir, configFile), { default: true });

  const config = isRecord(loaded) ? loaded : {};
  const { themes, skippedPresets } = collectThemes(config);

  const colors: Record<string, string> = {};
  const rounded: Record<string, string> = {};
  const spacing: Record<string, string> = {};
  const typography: Record<string, RawTypographyToken> = {};
  let darkTokenCount = 0;

  for (const theme of themes) {
    const tokens = isRecord(themeKey(theme, 'tokens')) ? (themeKey(theme, 'tokens') as UnknownRecord) : {};
    const semanticTokens = isRecord(themeKey(theme, 'semanticTokens'))
      ? (themeKey(theme, 'semanticTokens') as UnknownRecord)
      : {};

    Object.assign(
      colors,
      flattenTokenGroup(tokens.colors, resolveColorMix),
      flattenTokenGroup(semanticTokens.colors, resolveColorMix),
    );
    Object.assign(
      rounded,
      flattenTokenGroup(tokens.radii, normalizeDimension),
      flattenTokenGroup(semanticTokens.radii, normalizeDimension),
    );
    Object.assign(
      spacing,
      flattenTokenGroup(tokens.spacing, normalizeDimension),
      flattenTokenGroup(semanticTokens.spacing, normalizeDimension),
    );
    Object.assign(typography, flattenTextStyles(themeKey(theme, 'textStyles')));
    darkTokenCount += countDarkConditions(semanticTokens);
  }

  const warnings = skippedPresets.map(
    (preset) =>
      `Preset "${preset}" is referenced by name and was not resolved — its tokens are not mirrored. ` +
      'Import the preset as a value in panda.config if its tokens belong in DESIGN.md.',
  );

  return {
    framework: 'pandacss',
    sourceFiles: [configFile],
    tokens: {
      ...(Object.keys(colors).length > 0 && { colors }),
      ...(Object.keys(typography).length > 0 && { typography }),
      ...(Object.keys(rounded).length > 0 && { rounded }),
      ...(Object.keys(spacing).length > 0 && { spacing }),
    },
    ...(warnings.length > 0 && { warnings }),
    ...(darkTokenCount > 0 && { darkTokenCount }),
  };
}
