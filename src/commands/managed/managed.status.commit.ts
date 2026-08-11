import { existsSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import * as clack from '@clack/prompts';
import { S_BAR_H } from '@clack/prompts';
import { MARKDOWNLINT_CONFIG_FILE } from 'features/markdown/markdown.constants';
import { cancel, errorMessage, infoMessage, logMessage, successMessage, warnMessage } from 'utils';

import type { CommitDraft, CommitDraftCache } from 'lib/ai/commit-draft';
import { commitAllChanges } from 'lib/git/target-git-commit.utils';
import type { TargetGitChange } from 'lib/git/target-git-status.utils';
import { readTargetGitStatus } from 'lib/git/target-git-status.utils';
import { pc } from 'utils/picocolors';

import type { ManagedTarget } from 'types/managed.types';

/** Colors a porcelain status letter by what it means, dimmed so paths stay dominant. */
function colorCode(code: string): string {
  switch (code) {
    case 'A':
      return pc.dim(pc.green(code));
    case 'M':
      return pc.dim(pc.yellow(code));
    case 'D':
      return pc.dim(pc.red(code));
    case 'R':
    case 'C':
      return pc.dim(pc.cyan(code));
    case '?':
      // Bold to hold its weight against the dimmed letters, despite the muted grey.
      return pc.bold(pc.dim(pc.gray(code)));
    default:
      return pc.dim(code);
  }
}

/**
 * Collapses git's two porcelain columns (staged, unstaged) into the one code that
 * describes the change.
 *
 * The two-column form exists to separate staged from unstaged work, but this flow
 * runs `git add -A` and commits everything either way — so that distinction cannot
 * affect the user's decision here, and the second column is just noise.
 */
function effectiveCode(change: TargetGitChange): string {
  if (change.index === '?') return '?';
  return change.index === ' ' ? change.worktree : change.index;
}

function renderChange(change: TargetGitChange): string {
  return `  ${colorCode(effectiveCode(change))}  ${pc.gray(change.path)}`;
}

const DRAFT_LABEL = 'suggested commit message';
const CAPTION_SEPARATOR = pc.gray(' • ');

/** A caption line pairing the label with the model and latency, then the message itself. */
function renderDraft(draft: CommitDraft | null): string {
  if (draft === null) {
    return `${pc.dim('No AI draft available')} ${pc.gray('(Ollama unreachable or no models installed)')}`;
  }

  const caption = [pc.bold(pc.gray(DRAFT_LABEL)), pc.gray(draft.model), pc.gray(`${draft.elapsedMs}ms`)].join(
    CAPTION_SEPARATOR,
  );

  return `${caption}\n${pc.yellow(draft.message)}`;
}

/** Prompt for a message by hand — the fallback when no draft could be generated. */
async function promptManualMessage(): Promise<string | null> {
  const entered = await clack.text({
    message: 'Commit message:',
    placeholder: 'type(scope): subject',
    validate: (value) => {
      const trimmed = value?.trim() ?? '';
      if (trimmed.length === 0) return 'A commit message is required';
      return undefined;
    },
  });

  if (clack.isCancel(entered)) return null;
  return entered.trim();
}

type TargetOutcome = 'cancelled' | 'committed' | 'skipped';

/** Below this, a draft is effectively instant and a spinner would only flash. */
const SPINNER_DELAY_MS = 120;

const PENDING = Symbol('pending');

/**
 * Await a draft, showing a spinner only if it does not arrive near-instantly.
 *
 * A preloaded draft generated during the previous target's prompt is usually already
 * resolved, and starting a spinner for it would just flicker. A cold one (notably the
 * very first target) can take ~20s, which needs visible progress rather than a bare cursor.
 */
async function takeDraft(drafts: CommitDraftCache, targetDir: string): Promise<CommitDraft | null> {
  const pending = drafts.take(targetDir);
  const settled = await Promise.race([pending, delay(SPINNER_DELAY_MS).then(() => PENDING)]);

  if (settled !== PENDING) return settled as CommitDraft | null;

  const progress = clack.spinner();
  progress.start('Drafting commit message');
  const draft = await pending;
  progress.stop(draft === null ? 'No draft available' : 'Draft ready');
  return draft;
}

/**
 * Dim grey rule between targets. Clack has no divider primitive, but it exports the
 * horizontal bar glyph its own boxes are drawn with, so this stays visually consistent.
 */
function logDivider(): void {
  const width = Math.max(20, (process.stdout.columns ?? 80) - 6);
  logMessage(pc.dim(pc.gray(S_BAR_H.repeat(width))));
}

/** `(2/12)` — parens in dim cyan, the counter itself in normal cyan. */
function renderPosition(current: number, total: number): string {
  return `${pc.dim(pc.cyan('('))}${pc.cyan(`${current}/${total}`)}${pc.dim(pc.cyan(')'))}`;
}

/**
 * One target: show its pending files, then loop on the draft until the user accepts
 * it (Y -> commit) or asks for another (n -> regenerate).
 */
async function processTarget(
  target: ManagedTarget,
  drafts: CommitDraftCache,
  position: string,
): Promise<TargetOutcome> {
  const status = await readTargetGitStatus(target.path);
  if (status.changes.length === 0) {
    infoMessage(`${target.name}: nothing left to commit`);
    return 'skipped';
  }

  logMessage(
    `${pc.cyan(target.name)} ${position}${status.branch ? pc.dim(` [${status.branch}]`) : ''}\n${status.changes
      .map((change) => renderChange(change))
      .join('\n')}`,
  );

  let draft = await takeDraft(drafts, target.path);

  // Loop until accepted: `n` regenerates, `Y` commits.
  for (;;) {
    if (draft === null) {
      warnMessage('No AI draft available — enter a message manually.');
      const manual = await promptManualMessage();
      if (manual === null) return 'cancelled';
      return commitTarget(target, manual);
    }

    logMessage(renderDraft(draft));

    const accepted = await clack.confirm({
      message: 'Use this message?',
      active: 'Yes, commit',
      inactive: 'No, regenerate',
      initialValue: true,
    });

    if (clack.isCancel(accepted)) return 'cancelled';
    if (accepted) return commitTarget(target, draft.message);

    const progress = clack.spinner();
    progress.start('Generating a new message');
    drafts.invalidate(target.path);
    draft = await drafts.take(target.path);
    progress.stop(draft === null ? 'Generation failed' : 'New message ready');
  }
}

/** Tail of a rejected hook's output to keep. The reason is always at the end. */
const MAX_ERROR_LINES = 14;

/**
 * A rejected pre-commit hook can dump its whole transcript (lint-staged prints a line per
 * task). The actual reason is the last thing printed, so keep the head line naming the
 * failed command plus the tail, and elide the middle.
 */
function summarizeCommitError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const lines = raw.split('\n').filter((line) => line.trim() !== '');
  if (lines.length <= MAX_ERROR_LINES + 1) return lines.join('\n');

  const [head, ...rest] = lines;
  const elided = rest.length - MAX_ERROR_LINES;
  return [
    head,
    pc.dim(`… ${elided} more line${elided === 1 ? '' : 's'}`),
    ...rest.slice(-MAX_ERROR_LINES),
  ].join('\n');
}

/**
 * The one recurring failure worth naming explicitly: a target with `@finografic/md-lint`
 * wired but no `.markdownlint.jsonc` falls back to markdownlint defaults, where MD013
 * (line-length) is ON — while the shared config genx ships turns it OFF. Any long line
 * genx itself writes then blocks the commit.
 */
function missingMarkdownlintConfigHint(targetDir: string, errorText: string): string | null {
  if (!/md-lint|markdownlint|MD\d{3}/i.test(errorText)) return null;
  if (existsSync(join(targetDir, MARKDOWNLINT_CONFIG_FILE))) return null;

  return `Missing ${MARKDOWNLINT_CONFIG_FILE} — md-lint is using its defaults (MD013 line-length on).\nFix: genx audit --features=markdown`;
}

async function commitTarget(target: ManagedTarget, message: string): Promise<TargetOutcome> {
  try {
    const result = await commitAllChanges(target.path, message);
    if (!result.committed) {
      warnMessage(`${target.name}: nothing staged, skipped`);
      return 'skipped';
    }
    const branch = result.branch === undefined ? '' : pc.dim(` on ${result.branch}`);
    successMessage(`${target.name}: committed ${pc.cyan(result.hash ?? '')}${branch}`);
    if (result.stat !== undefined) logMessage(pc.dim(result.stat));

    return 'committed';
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const hint = missingMarkdownlintConfigHint(target.path, detail);

    errorMessage(`${target.name}: commit failed\n${summarizeCommitError(error)}`);
    if (hint !== null) errorMessage(hint);

    return 'skipped';
  }
}

/**
 * Walks the selected targets one at a time, pausing at each for confirmation.
 *
 * The draft for target N+1 is kicked off immediately after N's is taken, so it
 * generates while the user is reading and answering N's prompt.
 */
export async function runCommitPhase(targets: ManagedTarget[], drafts: CommitDraftCache): Promise<void> {
  let committed = 0;
  let skipped = 0;

  for (const [index, target] of targets.entries()) {
    // Separate each project from the previous one's output, whatever its outcome. Leading
    // the iteration (rather than trailing the commit) also avoids a trailing rule before
    // the run summary.
    if (index > 0) logDivider();

    // Start the next target's draft before blocking on this one's prompt.
    drafts.preload(targets[index + 1]?.path);

    const outcome = await processTarget(target, drafts, renderPosition(index + 1, targets.length));
    if (outcome === 'cancelled') {
      cancel();
      return;
    }
    if (outcome === 'committed') committed += 1;
    else skipped += 1;
  }

  successMessage(
    `Managed status complete (${committed} committed${skipped > 0 ? `, ${skipped} skipped` : ''})`,
  );
}
