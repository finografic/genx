import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { detectDesignSystems } from './detect.js';
import { extractPandacssTokens } from './pandacss.extractor.js';
import { extractTailwind4Tokens } from './tailwind4.extractor.js';

const FIXTURES = join(fileURLToPath(new URL('.', import.meta.url)), '../../../../test/fixtures/design-md');
const PANDA_DIR = join(FIXTURES, 'panda-project');
const TW4_DIR = join(FIXTURES, 'tailwind4-project');

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
});
