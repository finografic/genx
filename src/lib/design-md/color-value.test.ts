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
