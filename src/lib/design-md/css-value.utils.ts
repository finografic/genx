/**
 * CSS values in a real stylesheet are rarely literals. Tailwind v4 projects —
 * shadcn/ui ones especially — declare `@theme` entries that point at custom
 * properties defined elsewhere (`--color-primary: var(--primary)`) and derive
 * scales arithmetically (`--radius-sm: calc(var(--radius) * 0.6)`).
 *
 * Mirroring those verbatim into DESIGN.md records the indirection instead of
 * the design: an agent reading `var(--primary)` learns nothing, and the spec's
 * linter rejects it. These helpers flatten the indirection to the literal value
 * a browser would compute, and leave anything they cannot evaluate untouched.
 */

/** Index of the first comma not nested inside parentheses. */
function topLevelCommaIndex(input: string): number {
  let depth = 0;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
    } else if (char === ',' && depth === 0) {
      return index;
    }
  }
  return -1;
}

/**
 * Substitute `var(--name)` / `var(--name, fallback)` from `vars`, following
 * references transitively. An unknown name with no fallback, or a reference
 * cycle, is left as written rather than guessed at.
 */
export function resolveCssVars(
  value: string,
  vars: Record<string, string>,
  stack: Set<string> = new Set(),
): string {
  let out = '';
  let index = 0;

  while (index < value.length) {
    const start = value.indexOf('var(', index);
    if (start === -1) {
      out += value.slice(index);
      break;
    }
    out += value.slice(index, start);

    let depth = 1;
    let end = start + 'var('.length;
    while (end < value.length && depth > 0) {
      if (value[end] === '(') {
        depth += 1;
      } else if (value[end] === ')') {
        depth -= 1;
      }
      end += 1;
    }
    if (depth !== 0) {
      // Unbalanced — not something to interpret.
      out += value.slice(start);
      break;
    }

    const inner = value.slice(start + 'var('.length, end - 1);
    const comma = topLevelCommaIndex(inner);
    const name = (comma === -1 ? inner : inner.slice(0, comma)).trim().replace(/^--/, '');
    const fallback = comma === -1 ? null : inner.slice(comma + 1).trim();
    const literal = value.slice(start, end);

    if (stack.has(name)) {
      out += literal;
    } else if (vars[name] !== undefined) {
      stack.add(name);
      out += resolveCssVars(vars[name], vars, stack);
      stack.delete(name);
    } else if (fallback !== null) {
      out += resolveCssVars(fallback, vars, stack);
    } else {
      out += literal;
    }
    index = end;
  }

  return out;
}

interface Quantity {
  value: number;
  /** Empty string for a plain number. */
  unit: string;
}

type Token = { kind: 'quantity'; quantity: Quantity } | { kind: 'symbol'; symbol: string };

function tokenizeCalc(input: string): Token[] | null {
  const tokens: Token[] = [];
  const pattern = /\s*(?:([-+]?\d*\.?\d+)([a-z%]*)|([()+\-*/]))/giy;
  let index = 0;

  while (index < input.length) {
    pattern.lastIndex = index;
    const match = pattern.exec(input);
    if (!match) {
      return null;
    }
    if (match[1] !== undefined) {
      tokens.push({ kind: 'quantity', quantity: { value: Number(match[1]), unit: match[2] ?? '' } });
    } else {
      tokens.push({ kind: 'symbol', symbol: match[3] });
    }
    index = pattern.lastIndex;
  }
  return tokens;
}

/**
 * Combine two quantities. CSS requires compatible units: multiplication and
 * division need a unitless operand, addition and subtraction need matching
 * units. Anything else is not a value we are entitled to compute.
 */
function applyOperator(a: Quantity, operator: string, b: Quantity): Quantity | null {
  if (operator === '*') {
    if (a.unit !== '' && b.unit !== '') {
      return null;
    }
    return { value: a.value * b.value, unit: a.unit || b.unit };
  }
  if (operator === '/') {
    if (b.unit !== '' || b.value === 0) {
      return null;
    }
    return { value: a.value / b.value, unit: a.unit };
  }
  // + and -: units must match, except when one side is a bare zero.
  const unit = a.unit || b.unit;
  if (a.unit !== b.unit && a.value !== 0 && b.value !== 0) {
    return null;
  }
  return { value: operator === '+' ? a.value + b.value : a.value - b.value, unit };
}

function parseExpression(tokens: Token[], position: { index: number }): Quantity | null {
  let left = parseTerm(tokens, position);
  if (!left) {
    return null;
  }
  while (position.index < tokens.length) {
    const token = tokens[position.index];
    if (token.kind !== 'symbol' || (token.symbol !== '+' && token.symbol !== '-')) {
      break;
    }
    position.index += 1;
    const right = parseTerm(tokens, position);
    if (!right) {
      return null;
    }
    left = applyOperator(left, token.symbol, right);
    if (!left) {
      return null;
    }
  }
  return left;
}

function parseTerm(tokens: Token[], position: { index: number }): Quantity | null {
  let left = parseFactor(tokens, position);
  if (!left) {
    return null;
  }
  while (position.index < tokens.length) {
    const token = tokens[position.index];
    if (token.kind !== 'symbol' || (token.symbol !== '*' && token.symbol !== '/')) {
      break;
    }
    position.index += 1;
    const right = parseFactor(tokens, position);
    if (!right) {
      return null;
    }
    left = applyOperator(left, token.symbol, right);
    if (!left) {
      return null;
    }
  }
  return left;
}

function parseFactor(tokens: Token[], position: { index: number }): Quantity | null {
  const token = tokens[position.index];
  if (!token) {
    return null;
  }
  if (token.kind === 'quantity') {
    position.index += 1;
    return token.quantity;
  }
  if (token.symbol === '(') {
    position.index += 1;
    const inner = parseExpression(tokens, position);
    const closing = tokens[position.index];
    if (!inner || !closing || closing.kind !== 'symbol' || closing.symbol !== ')') {
      return null;
    }
    position.index += 1;
    return inner;
  }
  return null;
}

function formatQuantity({ value, unit }: Quantity): string {
  // Kill float noise from the arithmetic without forcing trailing zeros.
  return `${String(Number(value.toFixed(6)))}${unit}`;
}

/**
 * Evaluate `calc()` expressions, innermost first. Supports the arithmetic a
 * token scale actually uses (`+ - * /`, parentheses, one unit); anything with
 * incompatible units or unsupported functions is returned unchanged.
 */
export function evaluateCalc(value: string): string {
  let current = value;

  for (let guard = 0; guard < 10; guard += 1) {
    const start = current.lastIndexOf('calc(');
    if (start === -1) {
      return current;
    }

    let depth = 1;
    let end = start + 'calc('.length;
    while (end < current.length && depth > 0) {
      if (current[end] === '(') {
        depth += 1;
      } else if (current[end] === ')') {
        depth -= 1;
      }
      end += 1;
    }
    if (depth !== 0) {
      return current;
    }

    const inner = current.slice(start + 'calc('.length, end - 1);
    const tokens = tokenizeCalc(inner);
    if (!tokens) {
      return current;
    }
    const position = { index: 0 };
    const result = parseExpression(tokens, position);
    if (!result || position.index !== tokens.length) {
      return current;
    }
    current = current.slice(0, start) + formatQuantity(result) + current.slice(end);
  }

  return current;
}

/** Custom properties declared in `:root` — the base layer theme entries point at. */
export function parseRootProperties(css: string): Record<string, string> {
  const props: Record<string, string> = {};
  const pattern = /(^|[\s,}])(:root|html)\b[^{]*\{/g;
  let match: RegExpExecArray | null = pattern.exec(css);

  while (match !== null) {
    const start = match.index + match[0].length;
    let depth = 1;
    let index = start;
    while (index < css.length && depth > 0) {
      if (css[index] === '{') {
        depth += 1;
      } else if (css[index] === '}') {
        depth -= 1;
      }
      index += 1;
    }
    Object.assign(props, parseDeclarations(css.slice(start, index - 1)));
    match = pattern.exec(css);
  }
  return props;
}

function parseDeclarations(block: string): Record<string, string> {
  const props: Record<string, string> = {};
  const withoutComments = block.replace(/\/\*[\s\S]*?\*\//g, '');
  const pattern = /--([\w-]+)\s*:\s*([^;]+);/g;
  let match: RegExpExecArray | null = pattern.exec(withoutComments);

  while (match !== null) {
    const [, name, value] = match;
    if (name && value) {
      props[name] = value.trim();
    }
    match = pattern.exec(withoutComments);
  }
  return props;
}
