import { access, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, resolve as resolvePath } from 'node:path';
import * as clack from '@clack/prompts';
import pc from 'picocolors';
import type { DiffAction, DiffConfirmState } from '../../core/file-diff/file-diff.types.js';
import type { FeatureApplyResult } from '../../features/feature.types.js';
import type {
  FeaturePreviewChange,
  FeaturePreviewChangeDelete,
  FeaturePreviewChangeRenameBackup,
  FeaturePreviewChangeWrite,
  FeaturePreviewResult,
} from './feature-preview.types.js';

import { confirmFileWrite, createDiffConfirmState } from '../../core/file-diff/file-diff.utils.js';

/**
 * Empty-file deletes cannot use `confirmFileWrite('', '')` (core skips as identical). Using a fake
 * proposed string yields a misleading diff. Instead, show an explicit deletion preview and reuse the
 * same yes / skip / yes-to-all prompt shape as `confirmFileWrite`.
 */
async function confirmEmptyFileDelete(filePath: string, state?: DiffConfirmState): Promise<DiffAction> {
  clack.log.message(`${pc.bold(pc.white(filePath))}\n${pc.red('- (empty file — will be deleted)')}`);

  if (state?.yesAll) return 'write';

  const choice = await clack.select({
    message: `Apply changes to ${pc.cyan(filePath)}?`,
    options: [
      { value: 'write', label: 'Yes, write this file' },
      { value: 'skip', label: 'No, skip this file' },
      { value: 'write-all', label: 'Yes to all remaining files' },
    ],
  });

  if (clack.isCancel(choice)) return 'skip';

  if (choice === 'write-all' && state) {
    state.yesAll = true;
  }

  if (choice === 'write' || choice === 'skip' || choice === 'write-all') return choice;
  return 'skip';
}

async function confirmRenameBackup(
  fromPath: string,
  backupPath: string,
  state?: DiffConfirmState,
): Promise<DiffAction> {
  clack.log.message(
    `${pc.bold(pc.white(fromPath))}\n${pc.cyan(`→ ${backupPath}`)}\n${pc.dim('(Prettier config preserved as backup; not deleted)')}`,
  );

  if (state?.yesAll) {
    return 'write';
  }

  const choice = await clack.select({
    message: `Apply rename to backup for ${pc.cyan(fromPath)}?`,
    options: [
      { value: 'write', label: 'Yes, rename this file' },
      { value: 'skip', label: 'No, skip this file' },
      { value: 'write-all', label: 'Yes to all remaining files' },
    ],
  });

  if (clack.isCancel(choice)) return 'skip';

  if (choice === 'write-all' && state) {
    state.yesAll = true;
  }

  if (choice === 'write' || choice === 'skip' || choice === 'write-all') return choice;
  return 'skip';
}

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

export function createRenameBackupPreviewChange(
  path: string,
  backupPath: string,
  currentContent: string,
  exists: boolean,
  summary?: string,
): FeaturePreviewChangeRenameBackup {
  return { kind: 'renameBackup', path, backupPath, currentContent, exists, summary };
}

function appliedLabelForChange(change: FeaturePreviewChange): string {
  return change.summary ?? change.path;
}

export function isPreviewChangeChanged(change: FeaturePreviewChange): boolean {
  if (change.kind === 'write') {
    return change.currentContent !== change.proposedContent;
  }
  if (change.kind === 'renameBackup') {
    return change.exists;
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

/**
 * Picks the first non-existing backup path: `preferredBackupPath`, else `basename(sourcePath)` with
 * `--backup-2`, `--backup-3`, … suffix before the extension (same scheme as legacy Prettier migration).
 * Avoids clobbering an existing `--backup` file when re-running or when a stale backup remains.
 */
export async function resolveFirstAvailableRenameBackupPath(
  sourcePath: string,
  preferredBackupPath: string,
): Promise<string> {
  if (!(await pathExists(preferredBackupPath))) {
    return preferredBackupPath;
  }
  const dir = dirname(sourcePath);
  const name = basename(sourcePath);
  const ext = extname(name);
  const base = basename(name, ext || undefined);
  for (let i = 2; i < 100; i++) {
    const candidate = resolvePath(dir, `${base}--backup-${i}${ext || ''}`);
    if (!(await pathExists(candidate))) {
      return candidate;
    }
  }
  throw new Error(`Could not find a free backup path next to ${sourcePath}`);
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
  const appliedTargetPaths: string[] = [];

  for (const change of changed) {
    if (change.kind === 'write') {
      const currentOnDisk = await readUtf8(change.path);
      const action = await confirmFileWrite(change.path, currentOnDisk, change.proposedContent, state);
      if (action === 'skip') continue;
      await mkdir(dirname(change.path), { recursive: true });
      await writeFile(change.path, change.proposedContent, 'utf8');
      applied.push(appliedLabelForChange(change));
      appliedTargetPaths.push(change.path);
    } else if (change.kind === 'renameBackup') {
      if (!(await pathExists(change.path))) {
        continue;
      }
      const destPath = await resolveFirstAvailableRenameBackupPath(change.path, change.backupPath);
      const action = await confirmRenameBackup(change.path, destPath, state);
      if (action === 'skip') continue;
      await mkdir(dirname(destPath), { recursive: true });
      await rename(change.path, destPath);
      applied.push(appliedLabelForChange(change));
      appliedTargetPaths.push(change.path);
    } else {
      if (!(await pathExists(change.path))) {
        continue;
      }
      const currentOnDisk = await readUtf8(change.path);
      const action =
        currentOnDisk === ''
          ? await confirmEmptyFileDelete(change.path, state)
          : await confirmFileWrite(change.path, currentOnDisk, '', state);
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
      appliedTargetPaths.push(change.path);
    }
  }

  if (applied.length === 0) {
    return {
      applied: [],
      noopMessage: preview.noopMessage ?? 'All changes were skipped.',
    };
  }

  return { applied, appliedTargetPaths };
}
