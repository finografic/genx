import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { confirmFileWrite } from '@finografic/cli-kit/file-diff';
import type { DiffConfirmState } from '@finografic/cli-kit/file-diff';
import { applyTemplate, copyTemplate, ensureDir, fileExists, infoMessage } from 'utils';

import { isCliPackage } from 'lib/generators/cli-help.generator';

import { upgradeConfig } from 'config/upgrade.config';
import type { TemplateVars } from 'types/template.types';
import type { UpgradeOnlySection } from 'types/upgrade.types';

import { shouldRunSection } from './upgrade-metadata.utils.js';

/** Never copied into a target: editor and OS droppings that have no business in a package. */
const TEMPLATE_JUNK_FILES = new Set(['.DS_Store', 'Thumbs.db']);

/** True when the two differ only in trailing newlines — the same file, saved by a different editor. */
export function differsOnlyByTrailingNewline(current: string, proposed: string): boolean {
  return current !== proposed && current.replace(/\n+$/, '') === proposed.replace(/\n+$/, '');
}

interface SyncFile {
  sourcePath: string;
  destinationPath: string;
  /** Path shown in the diff header, relative to the target. */
  label: string;
}

/** Recursively list template files under `sourceDir`, skipping ignored prefixes and junk. */
async function collectDirectoryFiles(
  sourceDir: string,
  destinationDir: string,
  targetDir: string,
  ignore: readonly string[],
): Promise<SyncFile[]> {
  const files: SyncFile[] = [];

  async function walk(currentSource: string, currentDestination: string): Promise<void> {
    const entries = await readdir(currentSource, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = join(currentSource, entry.name);
      const destinationPath = join(currentDestination, entry.name);
      const relativePath = relative(sourceDir, sourcePath);

      if (ignore.some((prefix) => relativePath.startsWith(prefix))) continue;
      if (TEMPLATE_JUNK_FILES.has(entry.name)) continue;

      if (entry.isDirectory()) {
        await walk(sourcePath, destinationPath);
      } else if (entry.isFile()) {
        files.push({ sourcePath, destinationPath, label: relative(targetDir, destinationPath) });
      }
    }
  }

  await walk(sourceDir, destinationDir);
  return files;
}

/**
 * Sync files from `_templates/` into the target.
 *
 * Every write goes through `confirmFileWrite`, exactly like the package.json, gitignore and merge
 * operations. This used to copy straight over the top with no diff and no prompt, which meant two
 * of the seven upgrade operations silently discarded hand edits while the other five asked first —
 * so the menu could not be trusted as a whole and each entry had to be remembered individually.
 *
 * A file that already matches the template produces no output at all: `confirmFileWrite` returns
 * `'skip'` without rendering or prompting when the contents are identical.
 *
 * `packageJson` is used to omit `docs/spec/` (CLI core spec snapshot) when the target is not a CLI
 * package.
 */
export async function syncFromTemplate(
  targetDir: string,
  templateDir: string,
  vars: TemplateVars,
  only: Set<UpgradeOnlySection> | null,
  packageJson: Record<string, unknown>,
  diffState?: DiffConfirmState,
): Promise<void> {
  const syncTasks = upgradeConfig.syncFromTemplate.filter((item) => shouldRunSection(only, item.section));

  if (syncTasks.length === 0) {
    return;
  }

  const files: SyncFile[] = [];

  for (const item of syncTasks) {
    const sourcePath = resolve(templateDir, item.templatePath);
    const destinationPath = resolve(targetDir, item.targetPath);

    // Directory copy — `docs/spec/` is only for CLI packages (see docs/spec/CLI_CORE.md)
    if (item.templatePath === 'docs') {
      const ignoreSpec = isCliPackage(packageJson) ? [] : ['spec'];
      files.push(...(await collectDirectoryFiles(sourcePath, destinationPath, targetDir, ignoreSpec)));
      continue;
    }

    files.push({ sourcePath, destinationPath, label: item.targetPath });
  }

  let written = 0;

  for (const file of files) {
    const proposed = applyTemplate(await readFile(file.sourcePath, 'utf8'), vars);
    const current = fileExists(file.destinationPath) ? await readFile(file.destinationPath, 'utf8') : '';

    // A missing newline at end of file is not a content change, and prompting about one on every
    // run is noise the user cannot clear except by accepting it. Normalise it silently.
    if (current !== '' && differsOnlyByTrailingNewline(current, proposed)) {
      await writeFile(file.destinationPath, proposed, 'utf8');
      written += 1;
      continue;
    }

    const action = await confirmFileWrite(file.destinationPath, current, proposed, diffState);
    if (action === 'skip') continue;

    await ensureDir(dirname(file.destinationPath));
    await writeFile(file.destinationPath, proposed, 'utf8');
    written += 1;
  }

  if (written > 0) {
    infoMessage(`Synced ${written} file(s) from template`);
  }
}

/**
 * Copy LICENSE file from template if missing.
 */
export async function copyLicenseIfMissing(
  targetDir: string,
  templateDir: string,
  vars: TemplateVars,
  shouldCopy: boolean,
): Promise<void> {
  if (!shouldCopy) {
    return;
  }

  const licenseSourcePath = resolve(templateDir, 'LICENSE');
  const licenseDestPath = resolve(targetDir, 'LICENSE');
  await copyTemplate(licenseSourcePath, licenseDestPath, vars);
}
