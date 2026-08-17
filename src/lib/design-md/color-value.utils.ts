/**
 * Token values as authored in a design system are not always literal colors.
 * The DESIGN.md spec's linter (and any agent reading the file) expects a
 * concrete CSS color, so computed expressions are resolved where the result is
 * unambiguous and left verbatim where it is not.
 */

interface Oklch {
  /** Lightness as a percentage, 0–100. */
  l: number;
  c: number;
  /** Hue in degrees, or null when the colour is achromatic (powerless hue). */
  h: number | null;
  /** 0–1. Absent means fully opaque. */
  a: number;
}

const NAMED: Record<string, Oklch> = {
  white: { l: 100, c: 0, h: null, a: 1 },
  black: { l: 0, c: 0, h: null, a: 1 },
  // Mixing against `transparent` is how a design system spells "this token at N% alpha".
  transparent: { l: 0, c: 0, h: null, a: 0 },
};

function parseOklch(value: string): Oklch | null {
  const named = NAMED[value.toLowerCase()];
  if (named) {
    return named;
  }
  const match = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+%?)\s*)?\)$/i.exec(value);
  if (!match) {
    return null;
  }
  const [, l, c, h, alpha] = match;
  return { l: Number(l), c: Number(c), h: Number(h), a: parseAlpha(alpha) };
}

/** CSS accepts alpha as a 0–1 number or a percentage. */
function parseAlpha(raw: string | undefined): number {
  if (raw === undefined) return 1;
  return raw.endsWith('%') ? Number(raw.slice(0, -1)) / 100 : Number(raw);
}

/** Trim float noise (0.1 + 0.2 artefacts) without forcing trailing zeros. */
function round(value: number, decimals: number): string {
  return String(Number(value.toFixed(decimals)));
}

function formatOklch({ l, c, h, a }: Oklch): string {
  const base = `${round(l, 2)}% ${round(c, 4)} ${round(h ?? 0, 3)}`;
  return a >= 1 ? `oklch(${base})` : `oklch(${base} / ${round(a, 4)})`;
}

/**
 * Interpolate in OKLCH. An achromatic endpoint contributes no hue (CSS Color 4).
 *
 * Alpha is premultiplied, per CSS Color 5: each endpoint's colour contributes in proportion to
 * `weight × alpha`, and the result's alpha is the plain weighted sum. That is what makes
 * `color-mix(in oklch, C 50%, transparent)` collapse to C at 50% alpha rather than dragging C
 * halfway towards black.
 */
function mixOklch(a: Oklch, b: Oklch, weightA: number): Oklch {
  const weightB = 1 - weightA;
  const alpha = a.a * weightA + b.a * weightB;

  if (alpha === 0) {
    return { l: 0, c: 0, h: null, a: 0 };
  }

  const shareA = (a.a * weightA) / alpha;
  const shareB = (b.a * weightB) / alpha;
  const hue =
    shareA === 0
      ? b.h
      : shareB === 0
        ? a.h
        : a.c === 0
          ? b.h
          : b.c === 0
            ? a.h
            : interpolateHue(a.h, b.h, shareA);

  return { l: a.l * shareA + b.l * shareB, c: a.c * shareA + b.c * shareB, h: hue, a: alpha };
}

function interpolateHue(a: number | null, b: number | null, weightA: number): number | null {
  if (a === null || b === null) {
    return a ?? b;
  }
  // Shortest arc, matching the CSS default hue interpolation method.
  const delta = ((b - a + 540) % 360) - 180;
  return (a + delta * (1 - weightA) + 360) % 360;
}

/** Split on commas that are not inside parentheses. */
function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of input) {
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
    }
    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  parts.push(current.trim());
  return parts;
}

/** Pull a trailing `<pct>%` off a colour operand, e.g. `oklch(...) 82%`. */
function splitPercentage(operand: string): { color: string; percentage: number | null } {
  const match = /^(.*?)\s+([\d.]+)%$/.exec(operand);
  if (!match) {
    return { color: operand.trim(), percentage: null };
  }
  return { color: match[1].trim(), percentage: Number(match[2]) };
}

/**
 * Resolve `color-mix(in oklch, …)` to a literal `oklch()` value.
 *
 * Deliberately narrow: only the OKLCH interpolation space, and only operands
 * that are themselves `oklch()` or `white`/`black`/`transparent`. That covers
 * the shade-ramp and translucency idioms design systems actually use, and
 * anything else is returned untouched rather than approximated — a wrong colour
 * in DESIGN.md is worse than an unresolved expression, which the linter will
 * flag out loud. Widen this (a colour-space library) when a real project needs
 * another form.
 */
export function resolveColorMix(value: string): string {
  const trimmed = value.trim();
  const match = /^color-mix\(\s*in\s+oklch\s*,(.*)\)$/is.exec(trimmed);
  if (!match) {
    return value;
  }

  const operands = splitTopLevel(match[1]);
  if (operands.length !== 2) {
    return value;
  }

  const first = splitPercentage(operands[0]);
  const second = splitPercentage(operands[1]);
  const a = parseOklch(first.color);
  const b = parseOklch(second.color);
  if (!a || !b) {
    return value;
  }

  // CSS: a missing percentage is the remainder; both missing means 50/50.
  let weightA: number;
  if (first.percentage === null && second.percentage === null) {
    weightA = 0.5;
  } else if (first.percentage === null) {
    weightA = 1 - (second.percentage ?? 0) / 100;
  } else if (second.percentage === null) {
    weightA = first.percentage / 100;
  } else {
    const total = first.percentage + second.percentage;
    if (total === 0) {
      return value;
    }
    weightA = first.percentage / total;
  }

  if (weightA < 0 || weightA > 1) {
    return value;
  }
  return formatOklch(mixOklch(a, b, weightA));
}

/**
 * The spec validates `rounded` / `spacing` entries as dimensions, so a bare
 * zero — which every framework writes as `0` — needs a unit to pass. Purely a
 * serialization concern: `0` and `0px` are the same length.
 */
export function normalizeDimension(value: string): string {
  return value.trim() === '0' ? '0px' : value;
}
