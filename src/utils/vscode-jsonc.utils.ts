import { applyEdits, modify } from 'jsonc-parser';
import type { ModificationOptions } from 'jsonc-parser';

import { parseJsoncObject } from './jsonc.utils';

const formattingOptions: NonNullable<ModificationOptions['formattingOptions']> = {
  tabSize: 2,
  insertSpaces: true,
  eol: '\n',
};

function modOptsInsertBefore(beforeKey: string): ModificationOptions {
  return {
    formattingOptions,
    getInsertionIndex: (properties: string[]) => {
      const idx = properties.indexOf(beforeKey);
      return idx === -1 ? properties.length : idx;
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
 * Set `editor.defaultFormatter` on a `[language]` block, inserting that block before a root key when (re)creating it.
 */
export function setLanguageFormatterBlock(
  raw: string,
  language: string,
  formatterId: string,
  insertBeforeRootKey?: string,
): { text: string; changed: boolean } {
  const blockKey = `[${language}]`;
  const before = raw;
  let t = raw;
  const root = parseJsoncObject(t) as Record<string, unknown>;
  const existing = root[blockKey] as Record<string, unknown> | undefined;
  const nextBlock = {
    ...(existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {}),
    'editor.defaultFormatter': formatterId,
  };

  const keys = Object.keys(root);
  const blockIdx = keys.indexOf(blockKey);
  const anchorIdx = insertBeforeRootKey ? keys.indexOf(insertBeforeRootKey) : -1;

  if (existing?.['editor.defaultFormatter'] === formatterId) {
    if (!insertBeforeRootKey) {
      return { text: t, changed: false };
    }
    if (anchorIdx === -1) {
      return { text: t, changed: false };
    }
    if (blockIdx !== -1 && blockIdx < anchorIdx) {
      return { text: t, changed: false };
    }
  }

  if (blockKey in root) {
    t = removeRootPropertyJsonc(t, blockKey);
  }

  if (insertBeforeRootKey) {
    t = insertRootPropertyBefore(t, blockKey, nextBlock, insertBeforeRootKey);
  } else {
    t = setRootPropertyJsonc(t, blockKey, nextBlock);
  }

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
      t = setLanguageFormatterBlock(t, language, formatterId, undefined).text;
      updated = true;
      break;
    }
    if (!updated) break;
  }

  return { text: t, changed: t !== before };
}
