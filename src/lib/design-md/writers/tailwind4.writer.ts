import type { RawDesignTokens } from '../design-md.types.js';

import { extractThemeBlocks, parseCustomProperties } from '../extractors/tailwind4.extractor.js';

/**
 * Namespaces the writer owns. Inside `@theme`, `--color-*`, `--radius-*` and
 * `--spacing-*` are rebuilt from DESIGN.md tokens; every other custom
 * property (fonts, shadows, tracking, …) is preserved untouched.
 */
const OWNED_PREFIXES = ['color-', 'radius-', 'spacing-'];

function isOwned(propName: string): boolean {
  return propName === 'spacing' || OWNED_PREFIXES.some((prefix) => propName.startsWith(prefix));
}

function tokenDeclarations(tokens: RawDesignTokens, indent: string): string[] {
  const declarations: string[] = [];
  for (const [name, value] of Object.entries(tokens.colors ?? {})) {
    declarations.push(`${indent}--color-${name}: ${value};`);
  }
  for (const [name, value] of Object.entries(tokens.rounded ?? {})) {
    declarations.push(`${indent}--radius-${name}: ${value};`);
  }
  for (const [name, value] of Object.entries(tokens.spacing ?? {})) {
    declarations.push(
      name === 'base' ? `${indent}--spacing: ${value};` : `${indent}--spacing-${name}: ${value};`,
    );
  }
  return declarations;
}

/**
 * Rewrite the first `@theme` block of a CSS source so its owned namespaces
 * match the DESIGN.md tokens. Returns the updated CSS, or null when the file
 * has no `@theme` block.
 */
export function writeTailwind4Theme(css: string, tokens: RawDesignTokens): string | null {
  const blocks = extractThemeBlocks(css);
  const block = blocks[0];
  if (block === undefined) {
    return null;
  }

  const indentMatch = block.match(/^[ \t]+/m);
  const indent = indentMatch?.[0] ?? '  ';

  const preserved: string[] = [];
  const existing = parseCustomProperties(block);
  for (const line of block.split('\n')) {
    const propMatch = line.match(/^\s*--([\w-]+)\s*:/);
    const propName = propMatch?.[1];
    if (propName !== undefined && propName in existing && isOwned(propName)) {
      continue;
    }
    preserved.push(line);
  }

  while (preserved.length > 0 && preserved[0]?.trim() === '') {
    preserved.shift();
  }
  while (preserved.length > 0 && preserved.at(-1)?.trim() === '') {
    preserved.pop();
  }

  const rebuilt = [...tokenDeclarations(tokens, indent), ...(preserved.length > 0 ? ['', ...preserved] : [])];
  const newBlock = `\n${rebuilt.join('\n')}\n`;

  const blockStart = css.indexOf(block);
  return css.slice(0, blockStart) + newBlock + css.slice(blockStart + block.length);
}
