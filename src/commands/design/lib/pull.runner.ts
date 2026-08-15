import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import type { DesignSystemFramework, RawDesignTokens, TokenGroup } from 'lib/design-md/design-md.types';
import { TOKEN_GROUPS } from 'lib/design-md/design-md.types';
import { extractFromProject } from 'lib/design-md/extract';
import { parseDesignMd } from 'lib/design-md/parse';
import { serializeDesignMd, createSkeletonBody } from 'lib/design-md/serialize';
import { resolveSourceOfTruth } from 'lib/design-md/source-of-truth';
import { applyPreviewChanges, createWritePreviewChange } from 'lib/feature-preview/index';

export interface PullResult {
  status: 'applied' | 'up-to-date' | 'skipped' | 'error';
  message: string;
  /** Non-fatal extraction notes to surface alongside the result. */
  warnings?: string[];
}

/**
 * `genx design sync --pull` — refresh DESIGN.md token frontmatter from the
 * canonical design system. The markdown body is preserved verbatim; only
 * token groups the extractor produced are replaced (others, e.g. hand-written
 * `components`, are kept). Refuses when DESIGN.md declares itself canonical.
 */
export async function runPull(
  targetDir: string,
  options: { yes?: boolean; framework?: DesignSystemFramework; file?: string },
): Promise<PullResult> {
  const extraction = await extractFromProject(targetDir, { framework: options.framework });
  if (!extraction) {
    return {
      status: 'error',
      message:
        'No supported design system detected (pandacss, tailwind4). Pull refreshes DESIGN.md ' +
        'from a canonical design system — if DESIGN.md is your canonical source, there is nothing to pull.',
    };
  }

  const warnings = [...(extraction.extracted.warnings ?? [])];
  const darkTokenCount = extraction.extracted.darkTokenCount ?? 0;
  if (darkTokenCount > 0) {
    warnings.push(
      `${darkTokenCount} token${darkTokenCount === 1 ? '' : 's'} also define a dark value. The ` +
        'DESIGN.md schema has no concept of themes, so only the base (light) palette is mirrored — ' +
        'dark stays canonical in the design system.',
    );
  }

  // A design system was detected but yielded nothing. Writing a token-less DESIGN.md
  // would look like success while mirroring no design intent at all, so refuse.
  if (Object.keys(extraction.extracted.tokens).length === 0) {
    return {
      status: 'error',
      warnings,
      message:
        `Detected ${extraction.extracted.framework} (${extraction.detected.sourceFiles.join(', ')}) but ` +
        'extracted no tokens. Nothing would be mirrored, so DESIGN.md was left alone. Check that the ' +
        'config defines tokens directly or composes a preset imported as a value.',
    };
  }

  const designMdPath = join(targetDir, options.file ?? 'DESIGN.md');
  const exists = existsSync(designMdPath);
  const currentContent = exists ? readFileSync(designMdPath, 'utf8') : '';

  let nextTokens: RawDesignTokens;
  let body: string;

  if (exists) {
    const parsed = parseDesignMd(currentContent);
    const sourceOfTruth = resolveSourceOfTruth(parsed, { designSystemDetected: true });
    if (sourceOfTruth === 'design-md') {
      return {
        status: 'error',
        message:
          `${basename(designMdPath)} declares itself the canonical token source — pull would overwrite it. ` +
          'Use `genx design sync --push` to write DESIGN.md tokens into the design system instead.',
      };
    }
    nextTokens = { ...parsed.tokens };
    body = parsed.body;
  } else {
    const packageName = readPackageName(targetDir) ?? basename(targetDir);
    nextTokens = {
      'version': 'alpha',
      'name': packageName,
      'source-of-truth': 'design-system',
    };
    body = createSkeletonBody({
      name: packageName,
      canonicalSource: `\`${extraction.detected.sourceFiles.join('`, `')}\` (${extraction.extracted.framework})`,
      hasDarkPalette: darkTokenCount > 0,
    });
  }

  const removed: string[] = [];
  for (const group of TOKEN_GROUPS) {
    const extractedGroup = extraction.extracted.tokens[group];
    if (extractedGroup && Object.keys(extractedGroup).length > 0) {
      const currentGroup = (nextTokens as Record<TokenGroup, unknown>)[group];
      if (isTokenRecord(currentGroup)) {
        for (const token of Object.keys(currentGroup)) {
          if (!(token in extractedGroup)) {
            removed.push(`${group}.${token}`);
          }
        }
      }
      (nextTokens as Record<TokenGroup, unknown>)[group] = extractedGroup;
    }
  }

  // A group the extractor produces is replaced wholesale, so any entry DESIGN.md
  // holds but the design system does not is dropped. That entry is ambiguous —
  // hand-authored (must survive) or retired upstream (should go) — and genx has
  // no record of which. Interactively the diff makes the choice visible; with
  // `-y` it would not, so refuse rather than delete silently. Same fail-closed
  // shape as the seed-ownership and push guards.
  if (removed.length > 0 && options.yes) {
    return {
      status: 'error',
      warnings,
      message:
        `Pull would remove ${removed.length} token${removed.length === 1 ? '' : 's'} from ` +
        `${basename(designMdPath)} that the design system no longer defines: ${removed.slice(0, 6).join(', ')}` +
        `${removed.length > 6 ? `, +${removed.length - 6} more` : ''}. These may be hand-authored ` +
        'rather than stale, so they are not deleted without confirmation. Re-run without `-y` to ' +
        'review the diff, or delete them from DESIGN.md first.',
    };
  }

  const proposedContent = serializeDesignMd(nextTokens, body);
  if (proposedContent === currentContent) {
    return {
      status: 'up-to-date',
      warnings,
      message: 'DESIGN.md tokens already match the design system.',
    };
  }

  const result = await applyPreviewChanges(
    {
      changes: [
        createWritePreviewChange(
          designMdPath,
          currentContent,
          proposedContent,
          `sync DESIGN.md from ${extraction.extracted.framework}`,
        ),
      ],
      applied: [],
    },
    { yesAll: options.yes },
  );

  if (result.applied.length === 0) {
    return { status: 'skipped', warnings, message: 'Skipped — DESIGN.md was not modified.' };
  }
  return {
    status: 'applied',
    warnings,
    message: `DESIGN.md refreshed from ${extraction.extracted.framework} (${extraction.detected.sourceFiles.join(', ')}).`,
  };
}

function isTokenRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readPackageName(targetDir: string): string | undefined {
  try {
    const raw = readFileSync(join(targetDir, 'package.json'), 'utf8');
    const parsed = JSON.parse(raw) as { name?: unknown };
    return typeof parsed.name === 'string' ? parsed.name : undefined;
  } catch {
    return undefined;
  }
}
