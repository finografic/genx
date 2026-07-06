import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findPackageRoot } from 'utils/package-root.utils';

import { findGitignoreCommentSectionRange } from './gitignore-section.utils.js';

const PROJECT_SPECIFIC_HEADER = '# Project-specific';

let cachedCanonicalLines: readonly string[] | null = null;

function templatesDotGitignorePath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgRoot = findPackageRoot(here);
  return join(pkgRoot, '_templates', '.gitignore');
}

function normalizeNewlines(content: string): string {
  return content.replace(/\r\n/g, '\n');
}

function loadCanonicalGitignoreLines(): readonly string[] {
  if (cachedCanonicalLines) return cachedCanonicalLines;
  const raw = readFileSync(templatesDotGitignorePath(), 'utf8');
  cachedCanonicalLines = Object.freeze(normalizeNewlines(raw).split('\n'));
  return cachedCanonicalLines;
}

function isPatternLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length > 0 && !trimmed.startsWith('#');
}

function parseSectionHeader(line: string): string | null {
  const trimmed = line.trim();
  const match = trimmed.match(/^#\s+([A-Za-z].*)$/);
  return match ? match[1].trim().toLowerCase() : null;
}

function getCanonicalSectionTitles(lines: readonly string[]): ReadonlySet<string> {
  const titles = new Set<string>();
  for (const line of lines) {
    const title = parseSectionHeader(line);
    if (title) titles.add(title);
  }
  return titles;
}

function getCanonicalPatternSet(lines: readonly string[]): ReadonlySet<string> {
  return new Set(lines.filter(isPatternLine).map((line) => line.trim()));
}

function trimTrailingBlankLines(lines: string[]): string[] {
  const out = [...lines];
  while (out.length > 0 && out[out.length - 1]?.trim() === '') {
    out.pop();
  }
  return out;
}

function skipSection(lines: readonly string[], startIndex: number): number {
  let index = startIndex + 1;
  while (index < lines.length) {
    if (parseSectionHeader(lines[index] ?? '') !== null) break;
    index++;
  }
  return index;
}

/**
 * Collect target-only sections and pattern lines not present in `_templates/.gitignore`.
 * Canonical sections in the target are dropped (replaced by the template). Extras are appended after the
 * canonical body under `# Project-specific`.
 */
function extractTargetExtras(targetLines: string[], canonicalLines: readonly string[]): string[] {
  const canonicalSections = getCanonicalSectionTitles(canonicalLines);
  const canonicalPatterns = getCanonicalPatternSet(canonicalLines);
  const extras: string[] = [];
  let index = 0;

  while (index < targetLines.length) {
    const line = targetLines[index] ?? '';
    const sectionTitle = parseSectionHeader(line);

    if (sectionTitle === PROJECT_SPECIFIC_HEADER.slice(2).trim().toLowerCase()) {
      index++;
      while (index < targetLines.length) {
        const extraLine = targetLines[index] ?? '';
        if (parseSectionHeader(extraLine) !== null) break;
        if (isPatternLine(extraLine) && !canonicalPatterns.has(extraLine.trim())) {
          extras.push(extraLine);
        }
        index++;
      }
      continue;
    }

    if (sectionTitle) {
      if (canonicalSections.has(sectionTitle)) {
        index = skipSection(targetLines, index);
        continue;
      }

      const sectionLines: string[] = [line];
      index++;
      while (index < targetLines.length) {
        const nextLine = targetLines[index] ?? '';
        if (parseSectionHeader(nextLine) !== null) break;
        if (isPatternLine(nextLine) && !canonicalPatterns.has(nextLine.trim())) {
          sectionLines.push(nextLine);
        } else if (!isPatternLine(nextLine)) {
          sectionLines.push(nextLine);
        }
        index++;
      }

      const trimmedSection = trimTrailingBlankLines(sectionLines);
      if (trimmedSection.some(isPatternLine)) {
        if (extras.length > 0) extras.push('');
        extras.push(...trimmedSection);
      }
      continue;
    }

    if (isPatternLine(line) && !canonicalPatterns.has(line.trim())) {
      extras.push(line);
    }
    index++;
  }

  return trimTrailingBlankLines(extras);
}

/** Full canonical `.gitignore` from `_templates/.gitignore` (trimmed, no trailing newline). */
export function getCanonicalGitignoreBody(): string {
  return trimTrailingBlankLines([...loadCanonicalGitignoreLines()]).join('\n');
}

/**
 * Canonical `# Agents` block lines (from `_templates/.gitignore`). Exposed for tests and callers that need
 * the list.
 */
export function getCanonicalAgentsGitignoreLines(): readonly string[] {
  const lines = loadCanonicalGitignoreLines();
  const range = findGitignoreCommentSectionRange(lines, 'Agents');
  if (!range) {
    throw new Error(`# Agents section missing in ${templatesDotGitignorePath()}`);
  }
  return Object.freeze(lines.slice(range.start, range.end));
}

/** Rewrite legacy `.ai/` paths to `.agents/` (folder rename). */
export function rewriteDotAiPathsToAgents(content: string): string {
  return content.replace(/\.ai\//g, '.agents/');
}

/**
 * Merge a target `.gitignore` with `_templates/.gitignore`: canonical sections and patterns replace outdated
 * content; project-specific extras are preserved at the bottom under `# Project-specific`.
 */
export function proposeGitignoreMerge(content: string): string {
  const unified = normalizeNewlines(rewriteDotAiPathsToAgents(content));
  const canonicalLines = loadCanonicalGitignoreLines();
  const canonicalBody = getCanonicalGitignoreBody();
  const extras = extractTargetExtras(unified.split('\n'), canonicalLines);

  let result = canonicalBody;
  if (extras.length > 0) {
    result += `\n\n${PROJECT_SPECIFIC_HEADER}\n${extras.join('\n')}`;
  }
  result += '\n';

  const inputNorm = unified.endsWith('\n') ? unified : `${unified}\n`;
  if (result === inputNorm) return content;
  return result;
}

/** @deprecated Use `proposeGitignoreMerge` — kept for existing imports. */
export function proposeAgentsGitignoreMerge(content: string): string {
  return proposeGitignoreMerge(content);
}
