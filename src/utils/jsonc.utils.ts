import { parse } from 'jsonc-parser';

/**
 * Parse VS Code JSON (JSON with comments / trailing commas). Falls back to empty object when the document is
 * not an object.
 */
export function parseJsoncObject(raw: string): Record<string, unknown> {
  const data = parse(raw) as unknown;
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return {};
  }
  return data as Record<string, unknown>;
}
