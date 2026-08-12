import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseDesignMd } from 'lib/design-md/parse';
import { renderDesignHtml } from 'lib/design-md/render/render-html';

export interface RenderResult {
  exitCode: number;
  message: string;
}

/**
 * `genx design render` — generate a self-contained DESIGN.html preview from
 * DESIGN.md. A build artifact for humans; agents keep reading the markdown.
 */
export function runRender(targetDir: string, options: { file?: string; out?: string }): RenderResult {
  const designMdPath = join(targetDir, options.file ?? 'DESIGN.md');
  if (!existsSync(designMdPath)) {
    return { exitCode: 1, message: `No DESIGN.md found at ${designMdPath}.` };
  }

  const parsed = parseDesignMd(readFileSync(designMdPath, 'utf8'));
  const outPath = join(targetDir, options.out ?? 'DESIGN.html');
  writeFileSync(outPath, renderDesignHtml(parsed), 'utf8');

  return {
    exitCode: 0,
    message: `Rendered ${outPath} (generated artifact — consider gitignoring DESIGN.html).`,
  };
}
