/**
 * @file file-diff.utils.ts — SHARED diff-display + confirm layer for @finografic CLI tools.
 *
 * ⚠️  AVOID EDITING THIS FILE DIRECTLY.
 *
 * The exported API surface and behaviour must remain identical across all repos.
 * Minor formatter adjustments (blank lines, trailing commas) are acceptable.
 */

import * as clack from '@clack/prompts';
import { createPatch } from 'diff';
import pc from 'picocolors';
import type { DiffAction, DiffConfirmState } from './file-diff.types.js';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a fresh confirm-state object. Pass the same instance to every
 * `confirmFileWrite` call in a single command run so yes-to-all is honoured.
 */
export function createDiffConfirmState(): DiffConfirmState {
  return { yesAll: false };
}

/**
 * Render a unified diff of `currentContent` → `proposedContent` to stdout.
 * Lines are coloured: `+` green, `-` red, `@@` cyan, `---`/`+++` bold.
 * The unified-diff header lines (Index / ===) are suppressed for a cleaner output.
 */
export function renderFileDiff(filePath: string, currentContent: string, proposedContent: string): void {
  const patch = createPatch(filePath, currentContent, proposedContent);
  const lines = patch.split('\n');

  const rendered: string[] = [];
  for (const line of lines) {
    // Suppress the Index: / === header emitted by createPatch — we print our own header
    if (line.startsWith('Index:') || line.startsWith('=======')) continue;

    if (line.startsWith('---') || line.startsWith('+++')) {
      rendered.push(pc.bold(line));
    } else if (line.startsWith('@@')) {
      rendered.push(pc.cyan(line));
    } else if (line.startsWith('+')) {
      rendered.push(pc.green(line));
    } else if (line.startsWith('-')) {
      rendered.push(pc.red(line));
    } else {
      rendered.push(line);
    }
  }

  // Trim any trailing blank lines left by createPatch
  while (rendered.length > 0 && rendered[rendered.length - 1]?.trim() === '') {
    rendered.pop();
  }

  clack.log.message(`${pc.bold(pc.white(filePath))}\n${rendered.join('\n')}`);
}

/**
 * Show a per-file unified diff and prompt the user to confirm the write.
 *
 * - If `currentContent === proposedContent`, returns `'skip'` immediately (no-op, no prompt).
 * - If `state.yesAll` is true, renders the diff and returns `'write'` without prompting.
 * - Otherwise prompts: yes / skip / yes-to-all.
 *   Choosing yes-to-all sets `state.yesAll = true` for subsequent calls.
 *
 * Callers should write the file only when the return value is not `'skip'`:
 *
 * ```ts
 * const action = await confirmFileWrite(path, current, proposed, state);
 * if (action !== 'skip') await writeFile(path, proposed, 'utf8');
 * ```
 */
export async function confirmFileWrite(
  filePath: string,
  currentContent: string,
  proposedContent: string,
  state?: DiffConfirmState,
): Promise<DiffAction> {
  if (currentContent === proposedContent) return 'skip';

  renderFileDiff(filePath, currentContent, proposedContent);

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
