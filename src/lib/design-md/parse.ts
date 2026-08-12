import { parse as parseYaml } from 'yaml';
import type { ParsedDesignMd, RawDesignTokens } from './design-md.types.js';

/**
 * Split a DESIGN.md document into YAML frontmatter tokens and markdown body.
 * The body is preserved verbatim (it is human-owned prose) — only the
 * frontmatter is parsed. A document without frontmatter yields empty tokens.
 */
export function parseDesignMd(content: string): ParsedDesignMd {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);

  if (!match) {
    return { tokens: {}, body: content, hasFrontmatter: false };
  }

  const yamlSource = match[1] ?? '';
  // Trim the single blank separator line after the closing fence; serialization re-adds it.
  const body = content.slice(match[0].length).replace(/^\r?\n/, '');

  const parsed: unknown = parseYaml(yamlSource);
  const tokens: RawDesignTokens = isTokensRecord(parsed) ? parsed : {};

  return { tokens, body, hasFrontmatter: true };
}

function isTokensRecord(value: unknown): value is RawDesignTokens {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
