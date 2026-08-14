import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

import { parseDesignMd } from 'lib/design-md/parse';
import { renderDesignHtml } from 'lib/design-md/render/render-html';
import { applyPreviewChanges, createWritePreviewChange } from 'lib/feature-preview/index';

import { addGitignorePattern, isIgnoredByGit } from './render-gitignore.utils.js';

export interface RenderResult {
  exitCode: number;
  message: string;
}

/**
 * `genx design render` — generate a self-contained DESIGN.html preview from
 * DESIGN.md. A build artifact for humans; agents keep reading the markdown.
 *
 * The artifact is regenerated from source, so it is offered to `.gitignore`
 * (preview-gated — never written without confirmation). A project with no
 * `.gitignore` is left alone: creating one is a bigger decision than this
 * command has any business making.
 */
export async function runRender(
  targetDir: string,
  options: { file?: string; out?: string; yes?: boolean },
): Promise<RenderResult> {
  const designMdPath = join(targetDir, options.file ?? 'DESIGN.md');
  if (!existsSync(designMdPath)) {
    return { exitCode: 1, message: `No DESIGN.md found at ${designMdPath}.` };
  }

  const parsed = parseDesignMd(readFileSync(designMdPath, 'utf8'));
  const outPath = join(targetDir, options.out ?? 'DESIGN.html');
  writeFileSync(outPath, renderDesignHtml(parsed), 'utf8');

  const ignored = await offerGitignoreEntry(targetDir, outPath, options.yes);
  return {
    exitCode: 0,
    message: ignored
      ? `Rendered ${outPath}.`
      : `Rendered ${outPath} (generated artifact — consider gitignoring ${basename(outPath)}).`,
  };
}

/** True when the artifact ends up ignored, either already or by an accepted change. */
async function offerGitignoreEntry(
  targetDir: string,
  outPath: string,
  yes: boolean | undefined,
): Promise<boolean> {
  const relativeOut = relative(targetDir, outPath);
  if (relativeOut.startsWith('..')) {
    return false;
  }
  if (await isIgnoredByGit(targetDir, relativeOut)) {
    return true;
  }

  const gitignorePath = join(targetDir, '.gitignore');
  if (!existsSync(gitignorePath)) {
    return false;
  }

  const current = readFileSync(gitignorePath, 'utf8');
  const proposed = addGitignorePattern(current, relativeOut);
  if (proposed === null) {
    return true;
  }

  const result = await applyPreviewChanges(
    {
      changes: [createWritePreviewChange(gitignorePath, current, proposed, `ignore ${relativeOut}`)],
      applied: [],
    },
    { yesAll: yes },
  );
  return result.applied.length > 0;
}
