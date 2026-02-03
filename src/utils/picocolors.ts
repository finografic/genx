/**
 * Picocolors with ESM interop.
 * CJS "export =" becomes namespace.default when Node loads it as ESM,
 * so namespace.black is undefined. Use whichever has .black.
 */
import * as ns from 'picocolors';

const withDefault = (ns as { default?: unknown }).default;
export const pc = typeof withDefault === 'object' && withDefault !== null
    && typeof (withDefault as { black?: unknown }).black === 'function'
  ? (withDefault as typeof ns)
  : ns;
