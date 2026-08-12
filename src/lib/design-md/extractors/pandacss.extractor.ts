import { join } from 'node:path';
import { createJiti } from 'jiti';
import type { ExtractedTokens, RawTypographyToken } from '../design-md.types.js';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Rewrite Panda token references to flattened DESIGN.md names:
 * `{colors.brand.500}` → `{colors.brand-500}` (group prefix kept, path joined).
 */
function normalizeRefs(value: string): string {
  return value.replace(/\{(\w+)\.([^}]+)\}/g, (_m, group: string, path: string) => {
    return `{${group}.${path.split('.').join('-')}}`;
  });
}

/**
 * Panda token values are `{ value: X }` leaves in an arbitrarily nested tree;
 * semantic tokens may wrap conditions: `{ value: { base: X, _dark: Y } }`.
 * Flatten to `path-joined-name → base value`.
 */
function flattenTokenGroup(group: unknown): Record<string, string> {
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
      if (typeof raw === 'string' || typeof raw === 'number') {
        result[path.join('-')] = normalizeRefs(String(raw));
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
 * Extract DESIGN.md tokens from a `panda.config.*`. The config is loaded with
 * jiti (runtime TS support, resolution against the target project's own
 * node_modules), then `theme.tokens` / `theme.semanticTokens` / `theme.textStyles`
 * are mapped. Panda `recipes` → `components` mapping is deliberately not
 * attempted yet — recipe structure is too far from the spec's flat component
 * sub-tokens to map mechanically.
 */
export async function extractPandacssTokens(targetDir: string, configFile: string): Promise<ExtractedTokens> {
  const jiti = createJiti(join(targetDir, 'noop.js'), { interopDefault: true });
  const loaded = await jiti.import(join(targetDir, configFile), { default: true });

  const config = isRecord(loaded) ? loaded : {};
  const theme = isRecord(config.theme) ? config.theme : {};
  // Panda allows `theme.extend` alongside/instead of direct keys.
  const extend = isRecord(theme.extend) ? theme.extend : {};

  function themeKey(key: string): unknown {
    const direct = theme[key];
    const extended = extend[key];
    if (isRecord(direct) && isRecord(extended)) {
      return { ...direct, ...extended };
    }
    return extended ?? direct;
  }

  const tokens = isRecord(themeKey('tokens')) ? (themeKey('tokens') as UnknownRecord) : {};
  const semanticTokens = isRecord(themeKey('semanticTokens'))
    ? (themeKey('semanticTokens') as UnknownRecord)
    : {};

  const colors = {
    ...flattenTokenGroup(tokens.colors),
    ...flattenTokenGroup(semanticTokens.colors),
  };
  const rounded = { ...flattenTokenGroup(tokens.radii), ...flattenTokenGroup(semanticTokens.radii) };
  const spacing = { ...flattenTokenGroup(tokens.spacing), ...flattenTokenGroup(semanticTokens.spacing) };
  const typography = flattenTextStyles(themeKey('textStyles'));

  return {
    framework: 'pandacss',
    sourceFiles: [configFile],
    tokens: {
      ...(Object.keys(colors).length > 0 && { colors }),
      ...(Object.keys(typography).length > 0 && { typography }),
      ...(Object.keys(rounded).length > 0 && { rounded }),
      ...(Object.keys(spacing).length > 0 && { spacing }),
    },
  };
}
