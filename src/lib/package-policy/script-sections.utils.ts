import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findPackageRoot } from 'utils/package-root.utils';

import type { PackageJson } from 'types/package-json.types';

/**
 * Section headings in `scripts` are divider keys — `"---------- DEV_AND_BUILD"`, `"·········· UTILS"`.
 * The divider characters have drifted between repositories, so sections are matched by name, never
 * by the exact key.
 */
function sectionName(key: string): string | null {
  const match = /^[^A-Za-z]*([A-Z][A-Z_:]*)$/.exec(key.trim());
  return match?.[1] ?? null;
}

function isSectionHeading(key: string): boolean {
  return sectionName(key) !== null;
}

let cachedSections: Record<string, string> | undefined;

/**
 * Which section each canonical script belongs to, read from `_templates/package.json`.
 *
 * Derived rather than restated: a hand-kept map would be a second source for the same fact, and the
 * template is the one this repository already treats as canonical.
 */
export function getCanonicalScriptSections(): Record<string, string> {
  if (cachedSections) return cachedSections;

  const fromDir = fileURLToPath(new URL('.', import.meta.url));
  const templatePath = join(findPackageRoot(fromDir), '_templates/package.json');
  const template = JSON.parse(readFileSync(templatePath, 'utf8')) as PackageJson;

  const sections: Record<string, string> = {};
  let current: string | null = null;

  for (const key of Object.keys(template.scripts ?? {})) {
    const name = sectionName(key);
    if (name) {
      current = name;
      continue;
    }
    if (current) sections[key] = current;
  }

  cachedSections = sections;
  return sections;
}

/**
 * Add `key` to `scripts` at the end of its canonical section.
 *
 * Falls back to appending when the target has no such section — a package.json without headings is
 * not reorganised on the strength of one added script.
 */
export function addScriptInSection(
  scripts: Record<string, string>,
  key: string,
  value: string,
  section: string | undefined,
): Record<string, string> {
  const keys = Object.keys(scripts);
  const headingIndex = section ? keys.findIndex((entry) => sectionName(entry) === section) : -1;

  if (headingIndex === -1) {
    return { ...scripts, [key]: value };
  }

  // End of the section: the last key before the next heading.
  let insertAt = headingIndex + 1;
  while (insertAt < keys.length && !isSectionHeading(keys[insertAt])) {
    insertAt += 1;
  }

  const next: Record<string, string> = {};
  for (let index = 0; index < insertAt; index += 1) {
    next[keys[index]] = scripts[keys[index]];
  }
  next[key] = value;
  for (let index = insertAt; index < keys.length; index += 1) {
    next[keys[index]] = scripts[keys[index]];
  }

  return next;
}
