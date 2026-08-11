import { readTargetGitDiff } from 'lib/git/target-git-status.utils';

import { buildPrompt, cleanResponse, selectModel } from './commit-message.js';
import { generate, listInstalledModels, resolveOllamaHost, resolveOllamaModel } from './ollama.client.js';

export interface CommitDraft {
  elapsedMs: number;
  message: string;
  model: string;
}

/**
 * Draft a commit message for a target repo from its pending diff.
 * Returns `null` on every failure path (Ollama down, no models, empty response),
 * so callers fall back to manual entry without having to parse an error.
 *
 * Read-only: nothing is staged, because drafts are generated ahead of the user's
 * confirmation for repos they may still skip.
 */
export async function generateCommitDraft(targetDir: string): Promise<CommitDraft | null> {
  const pending = await readTargetGitDiff(targetDir);
  if (pending === null) return null;

  const host = resolveOllamaHost();
  const installed = await listInstalledModels(host);
  if (installed.length === 0) return null;

  const model = selectModel(installed, resolveOllamaModel());
  if (model === null) return null;

  const startedAt = Date.now();
  const raw = await generate(host, model, buildPrompt(pending));
  const elapsedMs = Date.now() - startedAt;
  if (raw === null) return null;

  const message = cleanResponse(raw);
  if (message.length === 0) return null;

  return { elapsedMs, message, model };
}

/**
 * Keeps one in-flight draft per target so generation overlaps the user reading and
 * answering the previous target's prompt.
 *
 * This works because awaiting a Clack prompt suspends the calling function, not the
 * event loop — a `fetch` started here keeps progressing while the prompt is on screen.
 * Rejections are absorbed at store time (not at await time), so a draft that fails
 * between preload and consumption can never surface as an unhandled rejection.
 */
export class CommitDraftCache {
  private readonly drafts = new Map<string, Promise<CommitDraft | null>>();

  /** Start (or reuse) a draft for `targetDir` without waiting for it. */
  preload(targetDir: string | undefined): void {
    if (targetDir === undefined || this.drafts.has(targetDir)) return;
    this.drafts.set(
      targetDir,
      generateCommitDraft(targetDir).catch(() => null),
    );
  }

  /** Await the preloaded draft, starting one now if it was never preloaded. */
  async take(targetDir: string): Promise<CommitDraft | null> {
    this.preload(targetDir);
    const draft = await this.drafts.get(targetDir);
    return draft ?? null;
  }

  /** Drop any cached draft so the next `take` regenerates from the current diff. */
  invalidate(targetDir: string): void {
    this.drafts.delete(targetDir);
  }
}
