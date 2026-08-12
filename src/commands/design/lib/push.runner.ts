import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import type { DesignSystemFramework } from 'lib/design-md/design-md.types';
import { detectDesignSystems } from 'lib/design-md/extractors/detect';
import { extractThemeBlocks, parseCustomProperties } from 'lib/design-md/extractors/tailwind4.extractor';
import { parseDesignMd } from 'lib/design-md/parse';
import { resolveSourceOfTruth } from 'lib/design-md/source-of-truth';
import { writePandacssTokensFile } from 'lib/design-md/writers/pandacss.writer';
import { writeTailwind4Theme } from 'lib/design-md/writers/tailwind4.writer';
import type { FeaturePreviewChange } from 'lib/feature-preview/index';
import { applyPreviewChanges, createWritePreviewChange } from 'lib/feature-preview/index';

function themePropsEqual(cssA: string, cssB: string): boolean {
  const propsOf = (css: string): Record<string, string> => {
    const merged: Record<string, string> = {};
    for (const block of extractThemeBlocks(css)) {
      Object.assign(merged, parseCustomProperties(block));
    }
    return merged;
  };
  const a = propsOf(cssA);
  const b = propsOf(cssB);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key] !== b[key]) {
      return false;
    }
  }
  return true;
}

export interface PushResult {
  status: 'applied' | 'up-to-date' | 'skipped' | 'error';
  message: string;
}

/**
 * `genx design sync --push` — write DESIGN.md tokens into the project's
 * design system files. Only legal when DESIGN.md is the canonical token
 * source; always preview-gated with per-file confirmation (`-y` is
 * deliberately ignored — push must never silently mutate a design system).
 */
export async function runPush(
  targetDir: string,
  options: { framework?: DesignSystemFramework; file?: string },
): Promise<PushResult> {
  const designMdPath = join(targetDir, options.file ?? 'DESIGN.md');
  if (!existsSync(designMdPath)) {
    return { status: 'error', message: `No DESIGN.md found at ${designMdPath}.` };
  }

  const parsed = parseDesignMd(readFileSync(designMdPath, 'utf8'));
  const detectedSystems = detectDesignSystems(targetDir);
  const detected = options.framework
    ? detectedSystems.find((d) => d.framework === options.framework)
    : detectedSystems[0];

  const sourceOfTruth = resolveSourceOfTruth(parsed, { designSystemDetected: detected !== undefined });
  if (sourceOfTruth !== 'design-md') {
    return {
      status: 'error',
      message:
        `${basename(designMdPath)} does not declare itself the canonical token source ` +
        '(`source-of-truth: design-md` in frontmatter, or a `## Source of Truth` section). ' +
        'Push writes DESIGN.md tokens INTO the design system — when the design system is canonical, ' +
        'use `genx design sync --pull` instead.',
    };
  }

  const changes: FeaturePreviewChange[] = [];
  let frameworkLabel: string;

  if (detected?.framework === 'tailwind4') {
    frameworkLabel = 'tailwind4';
    for (const file of detected.sourceFiles) {
      const cssPath = join(targetDir, file);
      const css = readFileSync(cssPath, 'utf8');
      const updated = writeTailwind4Theme(css, parsed.tokens);
      // Semantic no-op check: the writer normalizes declaration order, so
      // compare the resulting custom-property maps, not the raw text.
      if (updated !== null && updated !== css && !themePropsEqual(css, updated)) {
        changes.push(createWritePreviewChange(cssPath, css, updated, `update @theme in ${file}`));
      }
    }
  } else if (detected?.framework === 'pandacss') {
    frameworkLabel = 'pandacss';
    const configFile = detected.sourceFiles[0] ?? 'panda.config.ts';
    const genPath = join(targetDir, dirname(configFile), 'tokens.gen.ts');
    const current = existsSync(genPath) ? readFileSync(genPath, 'utf8') : '';
    const proposed = writePandacssTokensFile(parsed.tokens);
    if (proposed !== current) {
      changes.push(
        createWritePreviewChange(genPath, current, proposed, 'generate tokens.gen.ts from DESIGN.md'),
      );
    }
  } else {
    return {
      status: 'error',
      message: 'No supported design system detected to push into (pandacss, tailwind4).',
    };
  }

  if (changes.length === 0) {
    return { status: 'up-to-date', message: `Design system already matches DESIGN.md (${frameworkLabel}).` };
  }

  // Push is always interactive: never pass yesAll (see Non-Goals in TODO_DESIGN_COMMAND.md).
  const result = await applyPreviewChanges({ changes, applied: [] }, { yesAll: false });

  if (result.applied.length === 0) {
    return { status: 'skipped', message: 'Skipped — no design system files were modified.' };
  }
  return {
    status: 'applied',
    message:
      `Design system updated from DESIGN.md: ${result.applied.join(', ')}.` +
      (frameworkLabel === 'pandacss'
        ? ' Spread the generated tokens into panda.config.ts if not already wired.'
        : ''),
  };
}
