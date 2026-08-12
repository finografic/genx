import { stringify as stringifyYaml } from 'yaml';
import type { RawDesignTokens } from './design-md.types.js';

import { TOKEN_GROUPS } from './design-md.types.js';

/** Scalar keys serialized before token groups, in this order. */
const SCALAR_KEYS = ['version', 'name', 'description', 'source-of-truth'] as const;

/**
 * Serialize tokens + body back into a DESIGN.md document with a stable key
 * order (spec scalars first, then token groups in canonical order, then any
 * unknown extension keys). The body is appended verbatim.
 */
export function serializeDesignMd(tokens: RawDesignTokens, body: string): string {
  const ordered: Record<string, unknown> = {};
  const source = tokens as Record<string, unknown>;

  for (const key of SCALAR_KEYS) {
    if (source[key] !== undefined) {
      ordered[key] = source[key];
    }
  }
  for (const group of TOKEN_GROUPS) {
    const value = source[group];
    if (value !== undefined && Object.keys(value as object).length > 0) {
      ordered[group] = value;
    }
  }
  for (const [key, value] of Object.entries(source)) {
    if (!(key in ordered) && value !== undefined) {
      ordered[key] = value;
    }
  }

  const yaml = stringifyYaml(ordered, {
    lineWidth: 0,
    defaultStringType: 'PLAIN',
    defaultKeyType: 'PLAIN',
  }).trimEnd();

  const trimmedBody = body.replace(/^\r?\n/, '');
  return `---\n${yaml}\n---\n\n${trimmedBody.trimEnd()}\n`;
}

/**
 * Minimal body skeleton for a freshly created DESIGN.md. Prose is human-owned,
 * so this stays near-empty: pull must never invent design rationale.
 */
export function createSkeletonBody(options: { name: string; canonicalSource: string }): string {
  return [
    '# Design System',
    '',
    '## Overview',
    '',
    `Design system for ${options.name}. Describe the product personality, target audience,`,
    'and the feel the UI should evoke. (Human-owned — `genx design sync --pull` never edits prose.)',
    '',
    '## Source of Truth',
    '',
    `Tokens are canonical in ${options.canonicalSource}. This file mirrors them for agent`,
    'consumption — when they disagree, the design system wins; refresh with `genx design sync --pull`.',
    '',
  ].join('\n');
}
