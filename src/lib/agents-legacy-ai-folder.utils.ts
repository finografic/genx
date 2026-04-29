import { readdir, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileExists } from 'utils';
import type { FeaturePreviewChange } from './feature-preview/feature-preview.types.js';

import { rewriteDotAiPathsToAgents } from './agents-gitignore.utils.js';
import {
  createDeletePreviewChange,
  createWritePreviewChange,
} from './feature-preview/feature-preview.utils.js';

const LEGACY_AI = '.ai';
const AGENTS = '.agents';

/** Markdown / docs files commonly referencing `.ai/handoff.md` (aligned with agent-docs migration). */
export const DOT_AI_REFERENCE_FILES = [
  'CLAUDE.md',
  'AGENTS.md',
  'README.md',
  '.github/copilot-instructions.md',
] as const;

async function listRelativeFilesRecursive(dir: string, prefix = ''): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    const abs = join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await listRelativeFilesRecursive(abs, rel)));
    } else {
      out.push(rel);
    }
  }
  return out;
}

async function previewMoveSubtreeFiles(
  srcRoot: string,
  dstRoot: string,
  legacyLabelPrefix: string,
): Promise<FeaturePreviewChange[]> {
  const relFiles = await listRelativeFilesRecursive(srcRoot);
  const changes: FeaturePreviewChange[] = [];
  for (const rel of relFiles) {
    const srcAbs = join(srcRoot, rel);
    const dstAbs = join(dstRoot, rel);
    const body = await readFile(srcAbs, 'utf8');
    changes.push(
      createWritePreviewChange(dstAbs, '', body, `${AGENTS}/${rel} (from ${legacyLabelPrefix}${rel})`),
    );
    changes.push(
      createDeletePreviewChange(srcAbs, body, true, `${legacyLabelPrefix}${rel} (moved to ${AGENTS}/)`),
    );
  }
  return changes;
}

/**
 * Preview writes into `.agents/` + deletes under `.ai/` mirroring `migrateAiFolder` in agent-docs migration.
 */
export async function collectLegacyAiFolderMigrationChanges(
  targetDir: string,
): Promise<FeaturePreviewChange[]> {
  const aiRoot = join(targetDir, LEGACY_AI);
  if (!fileExists(aiRoot)) {
    return [];
  }

  const agentsRoot = join(targetDir, AGENTS);
  const changes: FeaturePreviewChange[] = [];

  if (!fileExists(agentsRoot)) {
    return previewMoveSubtreeFiles(aiRoot, agentsRoot, `${LEGACY_AI}/`);
  }

  const entries = await readdir(aiRoot, { withFileTypes: true });
  for (const ent of entries) {
    const srcAbs = join(aiRoot, ent.name);
    const dstAbs = join(agentsRoot, ent.name);
    if (fileExists(dstAbs)) {
      continue;
    }
    if (ent.isDirectory()) {
      changes.push(...(await previewMoveSubtreeFiles(srcAbs, dstAbs, `${LEGACY_AI}/${ent.name}/`)));
    } else {
      const body = await readFile(srcAbs, 'utf8');
      changes.push(
        createWritePreviewChange(dstAbs, '', body, `${AGENTS}/${ent.name} (from ${LEGACY_AI}/${ent.name})`),
      );
      changes.push(
        createDeletePreviewChange(srcAbs, body, true, `${LEGACY_AI}/${ent.name} (moved to ${AGENTS}/)`),
      );
    }
  }

  return changes;
}

export async function collectDotAiMarkdownReferenceUpdates(
  targetDir: string,
): Promise<FeaturePreviewChange[]> {
  const changes: FeaturePreviewChange[] = [];
  for (const rel of DOT_AI_REFERENCE_FILES) {
    const abs = resolve(targetDir, rel);
    if (!fileExists(abs)) {
      continue;
    }
    const raw = await readFile(abs, 'utf8');
    const updated = rewriteDotAiPathsToAgents(raw);
    if (updated !== raw) {
      changes.push(createWritePreviewChange(abs, raw, updated, `${rel} (.ai/ → .agents/)`));
    }
  }
  return changes;
}

async function directoryContainsAnyFile(dir: string): Promise<boolean> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isFile()) {
      return true;
    }
    if (e.isDirectory() && (await directoryContainsAnyFile(p))) {
      return true;
    }
  }
  return false;
}

/**
 * After preview writes/deletes are applied: remove `.ai/` if it has no files left (only empty dirs allowed).
 */
export async function finalizeLegacyAiFolderAfterApply(targetDir: string): Promise<void> {
  const aiPath = join(targetDir, LEGACY_AI);
  if (!fileExists(aiPath)) {
    return;
  }
  if (await directoryContainsAnyFile(aiPath)) {
    return;
  }
  await rm(aiPath, { recursive: true, force: true });
}
