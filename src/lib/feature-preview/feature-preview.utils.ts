import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { FeatureApplyResult } from '../../features/feature.types.js';
import type {
  FeaturePreviewChange,
  FeaturePreviewChangeDelete,
  FeaturePreviewChangeWrite,
  FeaturePreviewResult,
} from './feature-preview.types.js';

import { confirmFileWrite, createDiffConfirmState } from '../../core/file-diff/file-diff.utils.js';

export function createWritePreviewChange(
  path: string,
  currentContent: string,
  proposedContent: string,
): FeaturePreviewChangeWrite {
  return { kind: 'write', path, currentContent, proposedContent };
}

export function createDeletePreviewChange(
  path: string,
  currentContent: string,
  exists: boolean,
): FeaturePreviewChangeDelete {
  return { kind: 'delete', path, currentContent, exists };
}

export function isPreviewChangeChanged(change: FeaturePreviewChange): boolean {
  if (change.kind === 'write') {
    return change.currentContent !== change.proposedContent;
  }
  return change.exists;
}

export function getChangedPreviewChanges(changes: readonly FeaturePreviewChange[]): FeaturePreviewChange[] {
  return changes.filter(isPreviewChangeChanged);
}

export function hasPreviewChanges(changes: readonly FeaturePreviewChange[]): boolean;
export function hasPreviewChanges(preview: FeaturePreviewResult): boolean;
export function hasPreviewChanges(
  changesOrPreview: readonly FeaturePreviewChange[] | FeaturePreviewResult,
): boolean {
  const list: readonly FeaturePreviewChange[] = Array.isArray(changesOrPreview)
    ? changesOrPreview
    : (changesOrPreview as FeaturePreviewResult).changes;
  return getChangedPreviewChanges(list).length > 0;
}

async function readUtf8(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'ENOENT'
    ) {
      return '';
    }
    throw error;
  }
}

/**
 * Applies changed preview entries using the shared file-diff confirmation flow.
 * Reads current content from disk at apply time so the diff matches the workspace.
 */
export async function applyPreviewChanges(preview: FeaturePreviewResult): Promise<FeatureApplyResult> {
  const changed = getChangedPreviewChanges(preview.changes);
  if (changed.length === 0) {
    return {
      applied: [],
      noopMessage: preview.noopMessage ?? 'No changes to apply.',
    };
  }

  const state = createDiffConfirmState();
  const applied: string[] = [];

  for (const change of changed) {
    if (change.kind === 'write') {
      const currentOnDisk = await readUtf8(change.path);
      const action = await confirmFileWrite(change.path, currentOnDisk, change.proposedContent, state);
      if (action === 'skip') continue;
      await mkdir(dirname(change.path), { recursive: true });
      await writeFile(change.path, change.proposedContent, 'utf8');
      applied.push(change.path);
    } else {
      const currentOnDisk = await readUtf8(change.path);
      const action = await confirmFileWrite(change.path, currentOnDisk, '', state);
      if (action === 'skip') continue;
      try {
        await unlink(change.path);
      } catch (error) {
        if (
          !(
            error &&
            typeof error === 'object' &&
            'code' in error &&
            (error as { code?: string }).code === 'ENOENT'
          )
        ) {
          throw error;
        }
      }
      applied.push(change.path);
    }
  }

  if (applied.length === 0) {
    return {
      applied: [],
      noopMessage: preview.noopMessage ?? 'All changes were skipped.',
    };
  }

  return { applied };
}
