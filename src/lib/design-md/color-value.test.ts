import { describe, expect, it } from 'vitest';

import { normalizeDimension, resolveColorMix } from './color-value.utils.js';

const BASE = 'oklch(48.8% 0.243 264.376)';

describe('resolveColorMix', () => {
  it('mixes towards white', () => {
    // L: 0.82·48.8 + 0.18·100 = 58.016 · C: 0.82·0.243 · hue from the chromatic side
    expect(resolveColorMix(`color-mix(in oklch, ${BASE} 82%, white)`)).toBe('oklch(58.02% 0.1993 264.376)');
  });

  it('mixes towards black', () => {
    expect(resolveColorMix(`color-mix(in oklch, ${BASE} 15%, black)`)).toBe('oklch(7.32% 0.0364 264.376)');
  });

  it('treats a missing percentage as the remainder', () => {
    const explicit = resolveColorMix(`color-mix(in oklch, ${BASE} 30%, white 70%)`);
    expect(resolveColorMix(`color-mix(in oklch, ${BASE} 30%, white)`)).toBe(explicit);
  });

  it('defaults to an even mix when neither side is weighted', () => {
    expect(resolveColorMix(`color-mix(in oklch, ${BASE}, white)`)).toBe('oklch(74.4% 0.1215 264.376)');
  });

  it('interpolates hue on the shortest arc between two chromatic colours', () => {
    const mixed = resolveColorMix('color-mix(in oklch, oklch(50% 0.1 350) 50%, oklch(50% 0.1 10))');
    expect(mixed).toBe('oklch(50% 0.1 0)');
  });

  it('mixing with transparent yields the same colour at reduced alpha', () => {
    // Premultiplied alpha: transparent contributes no colour, only dilution. Averaging the
    // channels instead would drag the result towards black and change the hue.
    expect(resolveColorMix(`color-mix(in oklch, ${BASE} 50%, transparent)`)).toBe(
      'oklch(48.8% 0.243 264.376 / 0.5)',
    );
  });

  it('keeps the colour intact at any transparency weight', () => {
    expect(resolveColorMix(`color-mix(in oklch, ${BASE} 20%, transparent)`)).toBe(
      'oklch(48.8% 0.243 264.376 / 0.2)',
    );
  });

  it('reads an existing alpha on an operand', () => {
    expect(resolveColorMix('color-mix(in oklch, oklch(50% 0.1 264 / 0.4) 50%, transparent)')).toBe(
      'oklch(50% 0.1 264 / 0.2)',
    );
  });

  it('collapses a fully transparent mix', () => {
    expect(resolveColorMix('color-mix(in oklch, transparent 50%, transparent)')).toBe('oklch(0% 0 0 / 0)');
  });

  it('accepts unitless lightness, the form shadcn Tailwind v4 themes are written in', () => {
    // oklch(0.444 …) is the same colour as oklch(44.4% …) — CSS Color 4 allows both.
    expect(resolveColorMix('color-mix(in oklch, oklch(0.444 0.019 43.1) 50%, transparent)')).toBe(
      'oklch(44.4% 0.019 43.1 / 0.5)',
    );
  });

  it('treats unitless and percentage lightness as identical inputs', () => {
    const unitless = resolveColorMix('color-mix(in oklch, oklch(0.5 0.1 264) 40%, transparent)');
    const percent = resolveColorMix('color-mix(in oklch, oklch(50% 0.1 264) 40%, transparent)');
    expect(unitless).toBe(percent);
  });

  it('leaves unsupported forms untouched rather than approximating', () => {
    const srgb = 'color-mix(in srgb, #ff0000 50%, #0000ff)';
    expect(resolveColorMix(srgb)).toBe(srgb);
    const hexOperand = 'color-mix(in oklch, #ff0000 50%, white)';
    expect(resolveColorMix(hexOperand)).toBe(hexOperand);
  });

  it('passes through values that are not colour mixes', () => {
    expect(resolveColorMix('#1a1c1e')).toBe('#1a1c1e');
    expect(resolveColorMix('{colors.primary}')).toBe('{colors.primary}');
  });
});

describe('normalizeDimension', () => {
  it('gives a bare zero a unit so it validates as a dimension', () => {
    expect(normalizeDimension('0')).toBe('0px');
  });

  it('leaves every other value alone', () => {
    expect(normalizeDimension('0px')).toBe('0px');
    expect(normalizeDimension('0.5rem')).toBe('0.5rem');
    expect(normalizeDimension('9999px')).toBe('9999px');
  });
});
