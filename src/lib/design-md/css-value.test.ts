import { describe, expect, it } from 'vitest';

import { evaluateCalc, parseDarkProperties, parseRootProperties, resolveCssVars } from './css-value.utils.js';

const VARS = { primary: 'oklch(0.84 0.23 128)', brand: 'var(--primary)', radius: '0.625rem' };

describe('resolveCssVars', () => {
  it('substitutes a custom property', () => {
    expect(resolveCssVars('var(--primary)', VARS)).toBe('oklch(0.84 0.23 128)');
  });

  it('follows references transitively', () => {
    expect(resolveCssVars('var(--brand)', VARS)).toBe('oklch(0.84 0.23 128)');
  });

  it('uses the fallback when the property is unknown', () => {
    expect(resolveCssVars('var(--nope, #fff)', VARS)).toBe('#fff');
    expect(resolveCssVars('var(--nope, var(--primary))', VARS)).toBe('oklch(0.84 0.23 128)');
  });

  it('leaves an unknown property without a fallback as written', () => {
    expect(resolveCssVars('var(--nope)', VARS)).toBe('var(--nope)');
  });

  it('does not loop on a reference cycle', () => {
    const cyclic = { a: 'var(--b)', b: 'var(--a)' };
    expect(resolveCssVars('var(--a)', cyclic)).toBe('var(--a)');
  });

  it('substitutes inside a larger expression', () => {
    expect(resolveCssVars('calc(var(--radius) * 2)', VARS)).toBe('calc(0.625rem * 2)');
  });
});

describe('evaluateCalc', () => {
  it('multiplies a dimension by a scalar', () => {
    expect(evaluateCalc('calc(0.625rem * 0.6)')).toBe('0.375rem');
  });

  it('handles addition, division, and parentheses', () => {
    expect(evaluateCalc('calc(8px + 4px)')).toBe('12px');
    expect(evaluateCalc('calc(1rem / 2)')).toBe('0.5rem');
    expect(evaluateCalc('calc((2 + 1) * 8px)')).toBe('24px');
  });

  it('evaluates nested calc innermost first', () => {
    expect(evaluateCalc('calc(calc(4px * 2) + 2px)')).toBe('10px');
  });

  it('refuses to compute incompatible units', () => {
    expect(evaluateCalc('calc(1rem + 10px)')).toBe('calc(1rem + 10px)');
    expect(evaluateCalc('calc(2px * 3px)')).toBe('calc(2px * 3px)');
  });

  it('passes through values it cannot evaluate', () => {
    expect(evaluateCalc('calc(var(--radius) * 2)')).toBe('calc(var(--radius) * 2)');
    expect(evaluateCalc('1rem')).toBe('1rem');
  });
});

describe('parseRootProperties', () => {
  const CSS = `
    :root {
      --primary: #111;
      --radius: 0.5rem;
    }
    .dark {
      --primary: #eee;
    }
  `;

  it('reads the base layer only, ignoring dark overrides', () => {
    expect(parseRootProperties(CSS)).toEqual({ primary: '#111', radius: '0.5rem' });
  });
});

describe('parseDarkProperties', () => {
  it('reads a .dark class scope', () => {
    expect(parseDarkProperties('.dark { --primary: #eee; }')).toEqual({ primary: '#eee' });
  });

  it('reads a data-theme attribute scope', () => {
    expect(parseDarkProperties('[data-theme="dark"] { --primary: #eee; }')).toEqual({
      primary: '#eee',
    });
  });

  it('reads a prefers-color-scheme media query', () => {
    const css = '@media (prefers-color-scheme: dark) { :root { --primary: #eee; } }';
    expect(parseDarkProperties(css)).toEqual({ primary: '#eee' });
  });

  it('finds nothing in a single-palette stylesheet', () => {
    expect(parseDarkProperties(':root { --primary: #111; }')).toEqual({});
  });
});
