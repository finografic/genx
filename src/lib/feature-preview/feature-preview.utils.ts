import { access, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { FeatureApplyResult } from '../../features/feature.types.js';
import type {
  FeaturePreviewChange,
  FeaturePreviewChangeDelete,
  FeaturePreviewChangeWrite,
  FeaturePreviewResult,
} from './feature-preview.types.js';

import { confirmFileWrite, createDiffConfirmState } from '../../core/file-diff/file-diff.utils.js';

/**
 * Passed to `confirmFileWrite` as the proposed side for empty-file deletes only.
 * `confirmFileWrite` skips when current === proposed; empty vs empty would wrongly skip, so we use a
 * non-empty sentinel (never written — delete still unlinks). Not used when the file has content.
 */
const DELETE_CONFIRM_SENTINEL = '\u200b';

export function createWritePreviewChange(
  path: string,
  currentContent: string,
  proposedContent: string,
  summary?: string,
): FeaturePreviewChangeWrite {
  return { kind: 'write', path, currentContent, proposedContent, summary };
}

export function createDeletePreviewChange(
  path: string,
  currentContent: string,
  exists: boolean,
  summary?: string,
): FeaturePreviewChangeDelete {
  return { kind: 'delete', path, currentContent, exists, summary };
}

function appliedLabelForChange(change: FeaturePreviewChange): string {
  return change.summary ?? change.path;
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

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
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
      applied.push(appliedLabelForChange(change));
    } else {
      if (!(await pathExists(change.path))) {
        continue;
      }
      const currentOnDisk = await readUtf8(change.path);
      const proposedForConfirm = currentOnDisk === '' ? DELETE_CONFIRM_SENTINEL : '';
      const action = await confirmFileWrite(change.path, currentOnDisk, proposedForConfirm, state);
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
      applied.push(appliedLabelForChange(change));
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
