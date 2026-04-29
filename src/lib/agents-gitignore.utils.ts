import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findPackageRoot } from 'utils/package-root.utils';

import { findGitignoreCommentSectionRange } from './gitignore-section.utils.js';

let cachedAgentsSectionLines: readonly string[] | null = null;

function templatesDotGitignorePath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgRoot = findPackageRoot(here);
  return join(pkgRoot, '_templates', '.gitignore');
}

/** Lines of the `# Agents` block copied from `_templates/.gitignore` (single source of truth). */
function loadAgentsSectionLinesFromTemplate(): readonly string[] {
  if (cachedAgentsSectionLines) return cachedAgentsSectionLines;
  const raw = readFileSync(templatesDotGitignorePath(), 'utf8');
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const range = findGitignoreCommentSectionRange(lines, 'Agents');
  if (!range) {
    throw new Error(`# Agents section missing in ${templatesDotGitignorePath()}`);
  }
  cachedAgentsSectionLines = Object.freeze(lines.slice(range.start, range.end));
  return cachedAgentsSectionLines;
}

/**
 * Canonical `# Agents` … block lines (from `_templates/.gitignore`). Exposed for tests and callers that need
 * the list.
 */
export function getCanonicalAgentsGitignoreLines(): readonly string[] {
  return loadAgentsSectionLinesFromTemplate();
}

/** Rewrite legacy `.ai/` paths to `.agents/` (folder rename). */
export function rewriteDotAiPathsToAgents(content: string): string {
  return content.replace(/\.ai\//g, '.agents/');
}

/**
 * Replace the existing `# Agents` section in place with the block from `_templates/.gitignore`, or insert
 * that block after `# Environment files` (or before `# IDE`, or at EOF) when `# Agents` is absent.
 */
export function proposeAgentsGitignoreMerge(content: string): string {
  const unified = rewriteDotAiPathsToAgents(content).replace(/\r\n/g, '\n');
  let lines = unified.split('\n');
  const canonical = [...loadAgentsSectionLinesFromTemplate()];
  const canonicalPatterns = new Set(
    canonical.map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('#')),
  );

  const agentsRange = findGitignoreCommentSectionRange(lines, 'Agents');
  let nextLines: string[];

  if (agentsRange) {
    nextLines = [...lines.slice(0, agentsRange.start), ...canonical, ...lines.slice(agentsRange.end)];
  } else {
    lines = stripTrailingCanonicalGitignoreLines(lines, canonicalPatterns);
    const insertAt = findAgentsInsertionIndex(lines);
    const padBefore = insertAt > 0 && lines[insertAt - 1]?.trim() !== '' ? [''] : [];
    const padAfter = insertAt < lines.length && lines[insertAt]?.trim() !== '' ? [''] : [];
    nextLines = [
      ...lines.slice(0, insertAt),
      ...padBefore,
      ...canonical,
      ...padAfter,
      ...lines.slice(insertAt),
    ];
  }

  const result = nextLines.join('\n');
  const normalizedResult = result.endsWith('\n') ? result : `${result}\n`;
  const inputNorm = unified.endsWith('\n') ? unified : `${unified}\n`;

  if (normalizedResult === inputNorm) {
    return content;
  }
  return normalizedResult;
}

function findAgentsInsertionIndex(lines: string[]): number {
  const env = findGitignoreCommentSectionRange(lines, 'Environment files');
  if (env) return env.end;
  const ide = findGitignoreCommentSectionRange(lines, 'IDE');
  if (ide) return ide.start;
  return lines.length;
}

/** Remove stray `.agents/`-style lines pasted at EOF without a `# Agents` header (before inserting canonical). */
function stripTrailingCanonicalGitignoreLines(
  lines: string[],
  canonicalPatterns: ReadonlySet<string>,
): string[] {
  const out = [...lines];
  while (out.length > 0) {
    const last = out[out.length - 1]?.trim() ?? '';
    if (last === '') {
      out.pop();
      continue;
    }
    if (canonicalPatterns.has(last)) {
      out.pop();
      continue;
    }
    break;
  }
  return out;
}
