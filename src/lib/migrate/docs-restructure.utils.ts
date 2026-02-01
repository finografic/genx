import { existsSync } from 'node:fs';
import { rename } from 'node:fs/promises';
import { resolve } from 'node:path';

import { shouldRunSection } from 'src/lib/migrate/migrate-metadata.utils';
import { confirmReleasesRename } from 'src/lib/prompts/migrate.prompt';

import { ensureDir, fileExists, infoMessage } from 'utils';
import type { MigrateOnlySection } from 'types/migrate.types';

/**
 * Restructure docs/ folder by moving GitHub-related docs to docs/process/.
 * This runs BEFORE template sync to avoid overwriting existing restructured files.
 */
export async function restructureDocs(
  targetDir: string,
  only: Set<MigrateOnlySection> | null,
): Promise<void> {
  if (!shouldRunSection(only, 'docs')) {
    return;
  }

  const docsDir = resolve(targetDir, 'docs');
  const docsProcessDir = resolve(targetDir, 'docs/process');

  // Check if docs/ exists
  if (!existsSync(docsDir)) {
    return;
  }

  // Check if docs/process/ already exists with files - if so, skip restructuring
  const processDirExists = existsSync(docsProcessDir);
  const releaseProcessExists = fileExists(resolve(docsProcessDir, 'RELEASE_PROCESS.md'));
  const developerWorkflowExists = fileExists(resolve(docsProcessDir, 'DEVELOPER_WORKFLOW.md'));
  const githubPackagesExists = fileExists(resolve(docsProcessDir, 'GITHUB_PACKAGES_SETUP.md'));

  // If all files already exist in docs/process/, skip restructuring (silent abort)
  if (processDirExists && releaseProcessExists && developerWorkflowExists && githubPackagesExists) {
    // Silent abort - structure already correct
    return;
  }

  // Ensure docs/process/ exists
  await ensureDir(docsProcessDir);

  // Files to move from docs/ to docs/process/
  const filesToMove = [
    { from: 'DEVELOPER_WORKFLOW.md', to: 'DEVELOPER_WORKFLOW.md' },
    { from: 'GITHUB_PACKAGES_SETUP.md', to: 'GITHUB_PACKAGES_SETUP.md' },
    { from: 'RELEASES.md', to: 'RELEASE_PROCESS.md' },
  ];

  // Check and move files
  for (const file of filesToMove) {
    const sourcePath = resolve(docsDir, file.from);
    const destPath = resolve(docsProcessDir, file.to);

    // Only move if source exists and destination doesn't
    if (fileExists(sourcePath) && !fileExists(destPath)) {
      // Special handling for RELEASES.md: prompt for confirmation
      if (file.from === 'RELEASES.md') {
        const confirmed = await confirmReleasesRename();
        if (!confirmed) {
          infoMessage(`Skipped renaming ${file.from}`);
          continue;
        }
      }

      await rename(sourcePath, destPath);
      infoMessage(`Moved ${file.from} → docs/process/${file.to}`);
    }
  }
}
