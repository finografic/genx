import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExtractedTokens, RawTypographyToken } from '../design-md.types.js';

/** Extract the declaration bodies of every `@theme` block in a CSS source. */
export function extractThemeBlocks(css: string): string[] {
  const blocks: string[] = [];
  const pattern = /@theme\b[^{]*\{/g;
  let match: RegExpExecArray | null = pattern.exec(css);

  while (match !== null) {
    const start = match.index + match[0].length;
    let depth = 1;
    let index = start;
    while (index < css.length && depth > 0) {
      const char = css[index];
      if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
      }
      index += 1;
    }
    blocks.push(css.slice(start, index - 1));
    match = pattern.exec(css);
  }
  return blocks;
}

/** Parse `--custom-property: value;` declarations from a block body. */
export function parseCustomProperties(block: string): Record<string, string> {
  const props: Record<string, string> = {};
  const withoutComments = block.replace(/\/\*[\s\S]*?\*\//g, '');
  const pattern = /--([\w-]+)\s*:\s*([^;]+);/g;
  let match: RegExpExecArray | null = pattern.exec(withoutComments);

  while (match !== null) {
    const name = match[1];
    const value = match[2]?.trim();
    if (name && value) {
      props[name] = value;
    }
    match = pattern.exec(withoutComments);
  }
  return props;
}

/**
 * Map Tailwind v4 `@theme` namespaces onto DESIGN.md token groups:
 * `--color-*` → colors, `--radius-*` → rounded, `--spacing(-*)` → spacing,
 * `--font-*` (families) + `--text-*` (sizes, with `--text-x--line-height`
 * companions) → typography tokens named `text-<size>`.
 */
export function mapThemeProperties(props: Record<string, string>): ExtractedTokens['tokens'] {
  const colors: Record<string, string> = {};
  const rounded: Record<string, string> = {};
  const spacing: Record<string, string> = {};
  const families: Record<string, string> = {};
  const textSizes: Record<string, { fontSize?: string; lineHeight?: string }> = {};

  for (const [name, value] of Object.entries(props)) {
    if (name.startsWith('color-')) {
      colors[name.slice('color-'.length)] = value;
    } else if (name.startsWith('radius-')) {
      rounded[name.slice('radius-'.length)] = value;
    } else if (name === 'spacing') {
      spacing.base = value;
    } else if (name.startsWith('spacing-')) {
      spacing[name.slice('spacing-'.length)] = value;
    } else if (
      name.startsWith('font-weight-') ||
      name.startsWith('font-feature-') ||
      name.startsWith('font-variation-')
    ) {
      // Not mapped standalone; weights live on typography tokens.
    } else if (name.startsWith('font-')) {
      families[name.slice('font-'.length)] = value;
    } else if (name.startsWith('text-')) {
      const rest = name.slice('text-'.length);
      const lineHeightMatch = rest.match(/^(.+)--line-height$/);
      if (lineHeightMatch?.[1]) {
        (textSizes[lineHeightMatch[1]] ??= {}).lineHeight = value;
      } else if (!rest.includes('--')) {
        (textSizes[rest] ??= {}).fontSize = value;
      }
    }
  }

  const defaultFamily = families.sans ?? Object.values(families)[0];
  const typography: Record<string, RawTypographyToken> = {};
  for (const [size, style] of Object.entries(textSizes)) {
    typography[`text-${size}`] = {
      ...(defaultFamily && { fontFamily: defaultFamily }),
      ...(style.fontSize && { fontSize: style.fontSize }),
      ...(style.lineHeight && { lineHeight: style.lineHeight }),
    };
  }

  return {
    ...(Object.keys(colors).length > 0 && { colors }),
    ...(Object.keys(typography).length > 0 && { typography }),
    ...(Object.keys(rounded).length > 0 && { rounded }),
    ...(Object.keys(spacing).length > 0 && { spacing }),
  };
}

/** Extract DESIGN.md tokens from every `@theme` block across the given CSS files. */
export function extractTailwind4Tokens(targetDir: string, themeFiles: string[]): ExtractedTokens {
  const allProps: Record<string, string> = {};

  for (const file of themeFiles) {
    const css = readFileSync(join(targetDir, file), 'utf8');
    for (const block of extractThemeBlocks(css)) {
      Object.assign(allProps, parseCustomProperties(block));
    }
  }

  return {
    framework: 'tailwind4',
    sourceFiles: themeFiles,
    tokens: mapThemeProperties(allProps),
  };
}
