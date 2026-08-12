import { describe, expect, it } from 'vitest';
import type { ExtractedTokens } from './design-md.types.js';

import { compareTokens } from './compare.js';
import { parseDesignMd } from './parse.js';
import { serializeDesignMd } from './serialize.js';
import { resolveSourceOfTruth } from './source-of-truth.js';

const SAMPLE = `---
version: alpha
name: Sample
source-of-truth: design-system
colors:
  primary: "#1a1c1e"
  surface: "#ffffff"
rounded:
  md: 8px
---

# Design System

## Overview

Human-owned prose with **emphasis** and \`code\`.

## Source of Truth

Tokens are canonical in \`panda.config.ts\`.
`;

describe('parseDesignMd', () => {
  it('splits frontmatter tokens from body', () => {
    const parsed = parseDesignMd(SAMPLE);
    expect(parsed.hasFrontmatter).toBe(true);
    expect(parsed.tokens.name).toBe('Sample');
    expect(parsed.tokens.colors?.primary).toBe('#1a1c1e');
    expect(parsed.body.startsWith('# Design System')).toBe(true);
  });

  it('handles documents without frontmatter', () => {
    const parsed = parseDesignMd('# Just prose\n');
    expect(parsed.hasFrontmatter).toBe(false);
    expect(parsed.tokens).toEqual({});
    expect(parsed.body).toBe('# Just prose\n');
  });
});

describe('serializeDesignMd', () => {
  it('roundtrips: body preserved verbatim, tokens stable', () => {
    const parsed = parseDesignMd(SAMPLE);
    const serialized = serializeDesignMd(parsed.tokens, parsed.body);
    const reparsed = parseDesignMd(serialized);
    expect(reparsed.tokens).toEqual(parsed.tokens);
    expect(reparsed.body.trimEnd()).toBe(parsed.body.trimEnd());
  });

  it('is idempotent', () => {
    const parsed = parseDesignMd(SAMPLE);
    const once = serializeDesignMd(parsed.tokens, parsed.body);
    const reparsed = parseDesignMd(once);
    const twice = serializeDesignMd(reparsed.tokens, reparsed.body);
    expect(twice).toBe(once);
  });

  it('orders scalar keys before token groups', () => {
    const serialized = serializeDesignMd(
      { colors: { primary: '#fff' }, name: 'X', version: 'alpha' },
      'body',
    );
    const yamlPart = serialized.split('---')[1] ?? '';
    expect(yamlPart.indexOf('version')).toBeLessThan(yamlPart.indexOf('name'));
    expect(yamlPart.indexOf('name')).toBeLessThan(yamlPart.indexOf('colors'));
  });
});

describe('compareTokens', () => {
  const extracted: ExtractedTokens = {
    framework: 'tailwind4',
    sourceFiles: ['src/app.css'],
    tokens: {
      colors: { primary: '#1a1c1e', accent: '#b8422e' },
      rounded: { md: '8px' },
    },
  };

  it('reports no drift when in sync', () => {
    const report = compareTokens(
      { colors: { primary: '#1a1c1e', accent: '#b8422e' }, rounded: { md: '8px' } },
      extracted,
    );
    expect(report.hasDrift).toBe(false);
  });

  it('detects added, removed, and modified tokens', () => {
    const report = compareTokens(
      { colors: { primary: '#000000', stale: '#123456' }, rounded: { md: '8px' } },
      extracted,
    );
    expect(report.hasDrift).toBe(true);
    expect(report.groups.colors?.added).toEqual(['accent']);
    expect(report.groups.colors?.removed).toEqual(['stale']);
    expect(report.groups.colors?.modified).toEqual([
      { token: 'primary', current: '#000000', expected: '#1a1c1e' },
    ]);
  });

  it('ignores groups the extractor did not produce', () => {
    const report = compareTokens(
      {
        colors: { primary: '#1a1c1e', accent: '#b8422e' },
        rounded: { md: '8px' },
        components: { 'button-primary': { padding: '12px' } },
      },
      extracted,
    );
    expect(report.hasDrift).toBe(false);
    expect(report.groups.components).toBeUndefined();
  });
});

describe('resolveSourceOfTruth', () => {
  it('prefers the explicit frontmatter key', () => {
    const parsed = parseDesignMd('---\nsource-of-truth: design-md\n---\n\nbody\n');
    expect(resolveSourceOfTruth(parsed, { designSystemDetected: true })).toBe('design-md');
  });

  it('reads the prose Source of Truth section', () => {
    const parsed = parseDesignMd(SAMPLE);
    expect(resolveSourceOfTruth(parsed, { designSystemDetected: false })).toBe('design-system');
  });

  it('detects DESIGN.md-canonical prose', () => {
    const body = '## Source of Truth\n\nThis DESIGN.md is the canonical token source.\n';
    const parsed = parseDesignMd(`---\nname: X\n---\n\n${body}`);
    expect(resolveSourceOfTruth(parsed, { designSystemDetected: true })).toBe('design-md');
  });

  it('falls back to detection state', () => {
    const parsed = parseDesignMd('# no frontmatter, no section\n');
    expect(resolveSourceOfTruth(parsed, { designSystemDetected: true })).toBe('design-system');
    expect(resolveSourceOfTruth(parsed, { designSystemDetected: false })).toBe('design-md');
  });
});
