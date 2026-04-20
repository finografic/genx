import { applyEdits, getNodeValue, modify, parseTree } from 'jsonc-parser';
import type { ModificationOptions, Node } from 'jsonc-parser';

import { parseJsoncObject } from './jsonc.utils';

/** Root keys that must appear last in `.vscode/settings.json` (markdownlint first, then styles). */
export const VSCODE_MARKDOWN_TAIL_KEYS = ['markdownlint.config', 'markdown.styles'] as const;

const formattingOptions: NonNullable<ModificationOptions['formattingOptions']> = {
  tabSize: 2,
  insertSpaces: true,
  eol: '\n',
};

function modOptsInsertBefore(beforeKey: string): ModificationOptions {
  return {
    formattingOptions,
    getInsertionIndex: (properties: string[]) => {
      const index = properties.indexOf(beforeKey);
      return index === -1 ? properties.length : index;
    },
  };
}

/**
 * Set or update a root-level property. Preserves comments and formatting elsewhere in the file.
 */
export function setRootPropertyJsonc(text: string, key: string, value: unknown): string {
  const edits = modify(text, [key], value, { formattingOptions });
  return applyEdits(text, edits);
}

/**
 * Insert a root-level property before another key (e.g. before `prettier.enable`). If the key exists, updates in place.
 */
export function insertRootPropertyBefore(
  text: string,
  key: string,
  value: unknown,
  beforeKey: string,
): string {
  const edits = modify(text, [key], value, modOptsInsertBefore(beforeKey));
  return applyEdits(text, edits);
}

export function removeRootPropertyJsonc(text: string, key: string): string {
  const edits = modify(text, [key], undefined, { formattingOptions });
  return applyEdits(text, edits);
}

function rootPropertyKeyNames(root: Node): string[] {
  if (root.type !== 'object' || !root.children) return [];
  const names: string[] = [];
  for (const prop of root.children) {
    if (prop.type !== 'property' || !prop.children?.[0]) continue;
    const keyNode = prop.children[0];
    if (keyNode.type === 'string') {
      names.push(getNodeValue(keyNode) as string);
    }
  }
  return names;
}

function collectRootPropertySnippet(raw: string, key: string): string | undefined {
  const tree = parseTree(raw);
  if (!tree || tree.type !== 'object' || !tree.children) return undefined;
  for (const prop of tree.children) {
    if (prop.type !== 'property' || !prop.children?.[0]) continue;
    const keyNode = prop.children[0];
    if (keyNode.type !== 'string' || (getNodeValue(keyNode) as string) !== key) continue;
    return raw.slice(prop.offset, prop.offset + prop.length);
  }
  return undefined;
}

/**
 * Move `markdownlint.config` and `markdown.styles` to the end of the root object (in that order),
 * preserving the exact source text of each property (including `//` comments inside `markdownlint.config`).
 */
export function ensureMarkdownlintConfigAndStylesAtEnd(raw: string): { text: string; changed: boolean } {
  const before = raw;
  const tree = parseTree(raw);
  if (!tree || tree.type !== 'object' || !tree.children) {
    return { text: raw, changed: false };
  }

  const rootKeys = rootPropertyKeyNames(tree);
  const presentTailKeys = VSCODE_MARKDOWN_TAIL_KEYS.filter((k) => rootKeys.includes(k));
  if (presentTailKeys.length === 0) {
    return { text: raw, changed: false };
  }

  const tailOfFile = rootKeys.slice(-presentTailKeys.length);
  if (tailOfFile.length === presentTailKeys.length && presentTailKeys.every((k, i) => tailOfFile[i] === k)) {
    return { text: raw, changed: false };
  }

  const snippets: string[] = [];
  for (const key of VSCODE_MARKDOWN_TAIL_KEYS) {
    const sn = collectRootPropertySnippet(raw, key);
    if (sn !== undefined) snippets.push(sn.trimEnd());
  }
  if (snippets.length === 0) {
    return { text: raw, changed: false };
  }

  let t = raw;
  for (const key of [...VSCODE_MARKDOWN_TAIL_KEYS].reverse()) {
    if (rootKeys.includes(key)) {
      t = removeRootPropertyJsonc(t, key);
    }
  }

  const tree2 = parseTree(t);
  if (!tree2 || tree2.type !== 'object') {
    return { text: before, changed: false };
  }

  const insertPos = tree2.offset + tree2.length - 1;
  const head = t.slice(0, insertPos).trimEnd();
  const tail = t.slice(insertPos);
  const sep = head.endsWith('{') ? '' : ',';
  const body = snippets.join(',\n');
  const next = `${head}${body ? `${sep}\n${body}\n` : ''}${tail}`;

  return { text: next, changed: next !== before };
}

/**
 * Place oxfmt global editor keys immediately before `prettier.enable`, then set `prettier.enable` to false.
 */
export function ensureOxfmtSharedSettingsBeforePrettier(
  raw: string,
  formatterId: string,
): { text: string; changed: boolean } {
  const before = raw;
  let t = raw;

  const triple: Array<[string, unknown]> = [
    ['editor.formatOnSaveMode', 'file'],
    ['editor.defaultFormatter', formatterId],
    ['oxc.typeAware', true],
  ];

  const root = parseJsoncObject(t) as Record<string, unknown>;
  for (const [k] of triple) {
    if (k in root) {
      t = removeRootPropertyJsonc(t, k);
    }
  }

  for (let i = triple.length - 1; i >= 0; i--) {
    const [k, v] = triple[i]!;
    t = insertRootPropertyBefore(t, k, v, 'prettier.enable');
  }

  t = setRootPropertyJsonc(t, 'prettier.enable', false);

  return { text: t, changed: t !== before };
}

/**
 * Remove root keys whose names start with `prefix` (e.g. `dprint.`).
 */
export function removeRootKeysWithPrefix(raw: string, prefix: string): { text: string; changed: boolean } {
  let t = raw;
  const before = t;
  const root = parseJsoncObject(t) as Record<string, unknown>;
  for (const key of Object.keys(root)) {
    if (key.startsWith(prefix)) {
      t = removeRootPropertyJsonc(t, key);
    }
  }
  return { text: t, changed: t !== before };
}

/**
 * Set `editor.defaultFormatter` on a `[language]` block (`markdownlint.config` / `markdown.styles` are finalized separately via {@link ensureMarkdownlintConfigAndStylesAtEnd}).
 */
export function setLanguageFormatterBlock(
  raw: string,
  language: string,
  formatterId: string,
): { text: string; changed: boolean } {
  const blockKey = `[${language}]`;
  const before = raw;
  const root = parseJsoncObject(raw) as Record<string, unknown>;
  const existing = root[blockKey] as Record<string, unknown> | undefined;
  const nextBlock = {
    ...(existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {}),
    'editor.defaultFormatter': formatterId,
  };

  if (existing?.['editor.defaultFormatter'] === formatterId) {
    return { text: raw, changed: false };
  }

  let t = raw;
  if (blockKey in root) {
    t = removeRootPropertyJsonc(t, blockKey);
  }
  t = setRootPropertyJsonc(t, blockKey, nextBlock);

  return { text: t, changed: t !== before };
}

const DPRINT_FORMATTER_ID = 'dprint.dprint';

/** Replace `editor.defaultFormatter: dprint.dprint` inside `[…]` language blocks with the given formatter. */
export function replaceDprintLanguageFormatters(
  raw: string,
  formatterId: string,
): { text: string; changed: boolean } {
  const before = raw;
  let t = raw;

  for (;;) {
    const root = parseJsoncObject(t) as Record<string, unknown>;
    let updated = false;
    for (const key of Object.keys(root)) {
      if (!key.startsWith('[') || !key.endsWith(']')) continue;
      const block = root[key];
      if (!block || typeof block !== 'object' || Array.isArray(block)) continue;
      if ((block as Record<string, unknown>)['editor.defaultFormatter'] !== DPRINT_FORMATTER_ID) continue;

      const language = key.slice(1, -1);
      t = setLanguageFormatterBlock(t, language, formatterId).text;
      updated = true;
      break;
    }
    if (!updated) break;
  }

  return { text: t, changed: t !== before };
}
