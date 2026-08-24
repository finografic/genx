import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileExists } from 'utils';
import type { FeaturePreviewChange } from './feature-preview/feature-preview.types.js';

import {
  createDeletePreviewChange,
  createWritePreviewChange,
} from './feature-preview/feature-preview.utils.js';

/**
 * DEPRECATED: `.github/instructions/` was the original location, named after GitHub Copilot — the
 * first tool to standardise on the convention. `.agents/instructions/` is canonical: vendor neutral,
 * and what Claude Code, Cursor and Codex actually read.
 */
export const LEGACY_GITHUB_INSTRUCTIONS_DIR = '.github/instructions';

/** Editor and OS droppings: deleted with the rest of the tree, never carried across. */
const JUNK_FILES = new Set(['.DS_Store', 'Thumbs.db']);

async function listFilesRecursively(root: string): Promise<string[]> {
  const out: string[] = [];

  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        out.push(full);
      }
    }
  }

  await walk(root);
  return out;
}

/**
 * Retire `.github/instructions/`, moving anything the canonical tree does not already have.
 *
 * The original migration renamed the directory, and refused to act once `.agents/instructions/`
 * existed — "manual cleanup needed". That condition became permanent the moment this feature wrote
 * the canonical tree, so the legacy directory survived every upgrade, leaving two copies of the same
 * instructions and documents pointing at the stale one.
 *
 * A file with a canonical counterpart is deleted. A file without one — anything the project added
 * under `project/`, say — is written to the canonical tree first, so nothing project-specific is
 * lost on the way out.
 */
export async function collectLegacyGithubInstructionsChanges(params: {
  targetDir: string;
  /** Absolute path of the canonical `.agents/instructions/` directory. */
  canonicalRoot: string;
}): Promise<FeaturePreviewChange[]> {
  const legacyRoot = join(params.targetDir, LEGACY_GITHUB_INSTRUCTIONS_DIR);
  if (!fileExists(legacyRoot)) return [];

  const changes: FeaturePreviewChange[] = [];

  for (const legacyPath of await listFilesRecursively(legacyRoot)) {
    const relativePath = relative(legacyRoot, legacyPath);
    const label = `${LEGACY_GITHUB_INSTRUCTIONS_DIR}/${relativePath}`;

    if (JUNK_FILES.has(relative(legacyRoot, legacyPath).split('/').at(-1) ?? '')) {
      changes.push(createDeletePreviewChange(legacyPath, '', true, `${label} (junk)`));
      continue;
    }

    const body = await readFile(legacyPath, 'utf8');
    const canonicalPath = join(params.canonicalRoot, relativePath);

    if (!fileExists(canonicalPath)) {
      // Project-specific content with nowhere else to live — carry it over before removing it.
      changes.push(
        createWritePreviewChange(
          canonicalPath,
          '',
          body,
          `${relativePath} (moved from .github/instructions/)`,
        ),
      );
    }

    changes.push(
      createDeletePreviewChange(legacyPath, body, true, `${label} (superseded by .agents/instructions/)`),
    );
  }

  return changes;
}

/** Point documents at the canonical directory. Safe on content that never mentioned the old one. */
export function rewriteLegacyGithubInstructionsPaths(content: string): string {
  return content.replaceAll(`${LEGACY_GITHUB_INSTRUCTIONS_DIR}/`, '.agents/instructions/');
}
