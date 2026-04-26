#!/usr/bin/env tsx

/**
 * Triage planning and design documents.
 *
 * Scans known agent output locations for spec-like markdown files,
 * then prompts to move each to docs/specs/, docs/drafts/, or discard.
 *
 * Usage: pnpm triage:docs
 * pnpm triage:docs --scan-dir=custom/path
 */

import { copyFile, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import process from 'node:process';
import * as clack from '@clack/prompts';

import { fileExists } from '../src/utils/fs.utils';
import { pc } from '../src/utils/picocolors';

/* ────────────────────────────────────────────────────────── */
/* Config                                                      */
/* ────────────────────────────────────────────────────────── */

/** Known locations where agents drop planning artifacts */
const DEFAULT_SCAN_DIRS = [
  'docs/superpowers',
  'docs/superpowers/specs',
  'docs/superpowers/plans',
  'docs/planning',
  'docs/drafts',
  '.cursor/plans',
  '.claude/drafts',
];

/** Target directories */
const SPECS_DIR = 'docs/specs';
const DRAFTS_DIR = 'docs/drafts';

/** File patterns to consider */
const DOC_EXTENSIONS = new Set(['.md']);

/** Markers that suggest a file is a design spec (checked in content) */
const SPEC_MARKERS = [
  '## Goal',
  '## Non-Goals',
  '## Decision Summary',
  '## Architecture',
  '## Migration Strategy',
  '**Status:**',
  '## Chosen approach',
  '## Rejected approach',
  '## Proposed Architecture',
];

/** Markers that suggest a file is ephemeral (checked in content) */
const DRAFTS_MARKERS = [
  '- [ ]',
  '- [x]',
  '## Checklist',
  '## TODO',
  '## Tasks',
  'manual checks',
  'Quick test',
];

/* ────────────────────────────────────────────────────────── */
/* Helpers                                                     */
/* ────────────────────────────────────────────────────────── */

interface DocFile {
  absolutePath: string;
  relativePath: string;
  filename: string;
  content: string;
  suggestion: 'spec' | 'draft' | 'unknown';
}

function scoreMarkers(content: string, markers: string[]): number {
  return markers.filter((m) => content.includes(m)).length;
}

function suggestCategory(content: string): 'spec' | 'draft' | 'unknown' {
  const specScore = scoreMarkers(content, SPEC_MARKERS);
  const draftScore = scoreMarkers(content, DRAFTS_MARKERS);

  if (specScore >= 2 && specScore > draftScore) return 'spec';
  if (draftScore >= 2 && draftScore > specScore) return 'draft';
  return 'unknown';
}

async function findDocFiles(scanDirs: string[], cwd: string): Promise<DocFile[]> {
  const found: DocFile[] = [];

  for (const dir of scanDirs) {
    const absDir = resolve(cwd, dir);
    if (!fileExists(absDir)) continue;

    const dirStat = await stat(absDir);
    if (!dirStat.isDirectory()) continue;

    const entries = await readdir(absDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!DOC_EXTENSIONS.has(extname(entry.name))) continue;

      const absPath = join(absDir, entry.name);
      const content = await readFile(absPath, 'utf8');

      found.push({
        absolutePath: absPath,
        relativePath: relative(cwd, absPath),
        filename: entry.name,
        content,
        suggestion: suggestCategory(content),
      });
    }
  }

  return found;
}

function formatSuggestion(suggestion: DocFile['suggestion']): string {
  switch (suggestion) {
    case 'spec':
      return pc.cyan('spec');
    case 'draft':
      return pc.yellow('draft');
    case 'unknown':
      return pc.dim('unknown');
  }
}

function previewContent(content: string, maxLines: number = 6): string {
  const lines = content.split('\n').slice(0, maxLines);
  return lines.map((l) => pc.dim(`  │ ${l}`)).join('\n');
}

/* ────────────────────────────────────────────────────────── */
/* Main                                                        */
/* ────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  const cwd = process.cwd();

  // Parse --scan-dir flag for additional directories
  const args = process.argv.slice(2);
  const extraDirs: string[] = [];
  for (const arg of args) {
    if (arg.startsWith('--scan-dir=')) {
      extraDirs.push(arg.slice('--scan-dir='.length));
    }
  }

  const scanDirs = [...DEFAULT_SCAN_DIRS, ...extraDirs];

  clack.intro(pc.bgCyan(pc.black(' genx · triage docs ')));

  /* ── Scan ── */

  const spin = clack.spinner();
  spin.start('Scanning for planning artifacts...');

  const docs = await findDocFiles(scanDirs, cwd);

  if (docs.length === 0) {
    spin.stop('No documents found in scan directories');
    clack.outro(pc.dim('Nothing to triage'));
    return;
  }

  spin.stop(`Found ${docs.length} document${docs.length === 1 ? '' : 's'}`);

  /* ── Ensure target dirs ── */

  await mkdir(resolve(cwd, SPECS_DIR), { recursive: true });
  await mkdir(resolve(cwd, DRAFTS_DIR), { recursive: true });

  /* ── Triage each file ── */

  let movedToSpecs = 0;
  let movedToScratch = 0;
  let discarded = 0;
  let skipped = 0;

  for (const doc of docs) {
    clack.log.info(
      `${pc.bold(doc.relativePath)} ${pc.dim('·')} suggestion: ${formatSuggestion(doc.suggestion)}`,
    );

    console.log(previewContent(doc.content));
    console.log();

    const action = await clack.select({
      message: `What to do with ${doc.filename}?`,
      options: [
        {
          value: 'spec',
          label: `Move to ${SPECS_DIR}/`,
          hint: doc.suggestion === 'spec' ? 'suggested' : undefined,
        },
        {
          value: 'draft',
          label: `Move to ${DRAFTS_DIR}/ (gitignored)`,
          hint: doc.suggestion === 'draft' ? 'suggested' : undefined,
        },
        { value: 'discard', label: 'Delete' },
        { value: 'skip', label: 'Leave in place' },
      ],
    });

    if (clack.isCancel(action)) {
      clack.cancel('Operation cancelled');
      return;
    }

    switch (action) {
      case 'spec': {
        const dest = resolve(cwd, SPECS_DIR, doc.filename);
        await copyFile(doc.absolutePath, dest);
        await rm(doc.absolutePath);
        movedToSpecs++;
        clack.log.success(pc.green(`→ ${SPECS_DIR}/${doc.filename}`));
        break;
      }
      case 'draft': {
        const dest = resolve(cwd, DRAFTS_DIR, doc.filename);
        await copyFile(doc.absolutePath, dest);
        await rm(doc.absolutePath);
        movedToScratch++;
        clack.log.success(pc.yellow(`→ ${DRAFTS_DIR}/${doc.filename}`));
        break;
      }
      case 'discard': {
        const confirm = await clack.confirm({
          message: `Delete ${doc.filename}? This cannot be undone.`,
          initialValue: false,
        });
        if (clack.isCancel(confirm) || !confirm) {
          skipped++;
          break;
        }
        await rm(doc.absolutePath);
        discarded++;
        clack.log.warn(pc.dim(`Deleted ${doc.filename}`));
        break;
      }
      case 'skip': {
        skipped++;
        break;
      }
    }
  }

  /* ── Clean up empty directories ── */

  for (const dir of scanDirs) {
    const absDir = resolve(cwd, dir);
    if (!fileExists(absDir)) continue;

    try {
      const entries = await readdir(absDir);
      if (entries.length === 0) {
        await rm(absDir, { recursive: true });
        clack.log.info(pc.dim(`Removed empty directory: ${dir}`));
      }
    } catch {
      // Directory may have already been removed by parent cleanup
    }
  }

  /* ── Summary ── */

  clack.note(
    [
      movedToSpecs > 0 ? `${pc.cyan(`${movedToSpecs}`)} → ${SPECS_DIR}/` : null,
      movedToScratch > 0 ? `${pc.yellow(`${movedToScratch}`)} → ${DRAFTS_DIR}/` : null,
      discarded > 0 ? `${pc.red(`${discarded}`)} deleted` : null,
      skipped > 0 ? `${pc.dim(`${skipped}`)} skipped` : null,
    ]
      .filter(Boolean)
      .join('\n'),
    'Triage complete',
  );

  clack.outro(pc.green('Done'));
}

/* ────────────────────────────────────────────────────────── */
/* Bootstrap                                                    */
/* ────────────────────────────────────────────────────────── */

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
