import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { detectDesignSystems } from './detect.js';
import { extractPandacssTokens } from './pandacss.extractor.js';
import { extractTailwind4Tokens } from './tailwind4.extractor.js';

const FIXTURES = join(fileURLToPath(new URL('.', import.meta.url)), '../../../../test/fixtures/design-md');
const PANDA_DIR = join(FIXTURES, 'panda-project');
const PANDA_PRESET_DIR = join(FIXTURES, 'panda-preset-project');
const TW4_DIR = join(FIXTURES, 'tailwind4-project');
const TW4_SHADCN_DIR = join(FIXTURES, 'tailwind4-shadcn-project');

describe('detectDesignSystems', () => {
  it('detects pandacss via panda.config.ts', () => {
    const detected = detectDesignSystems(PANDA_DIR);
    expect(detected[0]?.framework).toBe('pandacss');
    expect(detected[0]?.sourceFiles).toEqual(['panda.config.ts']);
  });

  it('detects tailwind4 via @theme CSS', () => {
    const detected = detectDesignSystems(TW4_DIR);
    expect(detected[0]?.framework).toBe('tailwind4');
    expect(detected[0]?.sourceFiles).toEqual(['src/app.css']);
  });

  it('ignores @theme blocks in fixtures, demos, and examples', () => {
    // The fixtures root itself holds several `@theme` projects, none of which are
    // the design system of the repository that contains them.
    expect(detectDesignSystems(FIXTURES)).toEqual([]);
  });
});

describe('extractPandacssTokens', () => {
  it('flattens tokens, semantic tokens, and text styles', async () => {
    const result = await extractPandacssTokens(PANDA_DIR, 'panda.config.ts');
    expect(result.tokens.colors).toMatchObject({
      'primary': '#1a1c1e',
      'brand-500': '#2665fd',
      'brand-600': '#1e52d4',
      'surface': '#ffffff', // semantic token: base condition wins
      'accent': '{colors.brand-500}', // ref path flattened
    });
    expect(result.tokens.rounded).toEqual({ sm: '4px', md: '8px' });
    expect(result.tokens.spacing).toEqual({ sm: '8px', md: '16px' });
    expect(result.tokens.typography?.['body-md']).toEqual({
      fontFamily: 'Inter',
      fontSize: '16px',
      fontWeight: 400,
      lineHeight: 1.6,
    });
  });

  it('merges tokens from object presets, config theme winning', async () => {
    const result = await extractPandacssTokens(PANDA_PRESET_DIR, 'panda.config.ts');
    // Preset-only tokens are mirrored; without preset merging the whole file is empty.
    expect(result.tokens.colors?.surface).toBe('#ffffff');
    expect(result.tokens.typography?.body).toEqual({ fontSize: '1rem', lineHeight: 1.5 });
    // Config theme overrides the preset for the same token.
    expect(result.tokens.rounded?.md).toBe('0.75rem');
  });

  it('maps Panda DEFAULT keys onto the bare token name', async () => {
    const result = await extractPandacssTokens(PANDA_PRESET_DIR, 'panda.config.ts');
    expect(result.tokens.colors?.primary).toBe('oklch(48.8% 0.243 264.376)');
    expect(result.tokens.colors?.['primary-DEFAULT']).toBeUndefined();
    // References to a DEFAULT are rewritten the same way.
    expect(result.tokens.colors?.accent).toBe('{colors.primary}');
  });

  it('resolves color-mix ramps and gives bare zeros a unit', async () => {
    const result = await extractPandacssTokens(PANDA_PRESET_DIR, 'panda.config.ts');
    expect(result.tokens.colors?.['primary-light']).toBe('oklch(58.02% 0.1993 264.376)');
    expect(result.tokens.colors?.['primary-dark']).toBe('oklch(40.02% 0.1993 264.376)');
    expect(result.tokens.rounded?.none).toBe('0px');
    expect(result.tokens.spacing?.['0']).toBe('0px');
  });

  it('reports presets referenced by name instead of resolving them', async () => {
    const result = await extractPandacssTokens(PANDA_PRESET_DIR, 'panda.config.ts');
    expect(result.warnings?.[0]).toContain('@pandacss/preset-panda');
  });

  it('counts dark conditions without mirroring them', async () => {
    const result = await extractPandacssTokens(PANDA_PRESET_DIR, 'panda.config.ts');
    expect(result.darkTokenCount).toBe(2);
    // The base value is what reaches DESIGN.md.
    expect(result.tokens.colors?.surface).toBe('#ffffff');
    expect(result.tokens.colors?.text).toBe('#111111');
  });
});

describe('extractTailwind4Tokens', () => {
  it('maps @theme namespaces onto token groups', () => {
    const result = extractTailwind4Tokens(TW4_DIR, ['src/app.css']);
    expect(result.tokens.colors).toEqual({
      primary: '#1a1c1e',
      secondary: '#6c7278',
      surface: '#f7f5f2',
    });
    expect(result.tokens.rounded).toEqual({ sm: '4px', md: '8px' });
    expect(result.tokens.spacing).toEqual({ base: '0.25rem', gutter: '24px' });
    expect(result.tokens.typography?.['text-base']).toEqual({
      fontFamily: "'Public Sans', sans-serif",
      fontSize: '1rem',
      lineHeight: '1.6',
    });
    expect(result.tokens.typography?.['text-lg']).toEqual({
      fontFamily: "'Public Sans', sans-serif",
      fontSize: '1.125rem',
    });
  });

  it('resolves shadcn var() indirection against the :root palette', () => {
    const result = extractTailwind4Tokens(TW4_SHADCN_DIR, ['src/app.css']);
    expect(result.tokens.colors).toMatchObject({
      background: 'oklch(1 0 0)',
      foreground: 'oklch(0.147 0.004 49.25)',
      primary: 'oklch(0.841 0.238 128.85)',
    });
    // Light mode is the mirrored palette; `.dark` is a second one.
    expect(result.tokens.colors?.background).not.toBe('oklch(0.147 0.004 49.25)');
  });

  it('falls back inside var() and leaves unresolvable references alone', () => {
    const result = extractTailwind4Tokens(TW4_SHADCN_DIR, ['src/app.css']);
    expect(result.tokens.colors?.muted).toBe('oklch(0.97 0.001 106.424)');
    expect(result.tokens.colors?.missing).toBe('var(--nowhere)');
  });

  it('evaluates calc() scales into literal dimensions', () => {
    const result = extractTailwind4Tokens(TW4_SHADCN_DIR, ['src/app.css']);
    expect(result.tokens.rounded).toEqual({ sm: '0.375rem', lg: '0.625rem', xl: '0.875rem' });
    expect(result.tokens.spacing).toEqual({ gutter: '24px' });
  });

  it('resolves font families through indirection', () => {
    const result = extractTailwind4Tokens(TW4_SHADCN_DIR, ['src/app.css']);
    // No --text-* sizes here, so typography stays empty rather than invented.
    expect(result.tokens.typography).toBeUndefined();
  });

  it('counts the dark palette it deliberately does not mirror', () => {
    const result = extractTailwind4Tokens(TW4_SHADCN_DIR, ['src/app.css']);
    // --background, --foreground, --primary are overridden in `.dark`.
    expect(result.darkTokenCount).toBe(3);
  });

  it('reports no dark palette when the project has none', () => {
    expect(extractTailwind4Tokens(TW4_DIR, ['src/app.css']).darkTokenCount).toBeUndefined();
  });
});
