import { isDeepStrictEqual } from 'node:util';
import { parseJsoncObject } from '@finografic/cli-kit/xdg';

export { parseJsoncObject };

/**
 * True when two JSON or JSONC texts parse to the same value (object/array/primitives). Ignores whitespace,
 * key order (via deep equality), and trivial formatting differences — useful for `.vscode/settings.json`,
 * `extensions.json`, `package.json`, etc.
 */
export function jsonLikeTextsEquivalent(a: string, b: string): boolean {
  if (a === b) return true;
  try {
    return isDeepStrictEqual(parseJsoncObject(a), parseJsoncObject(b));
  } catch {
    return false;
  }
}
