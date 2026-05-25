import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileExists } from 'utils';
import type { FeaturePreviewResult } from '../../lib/feature-preview/feature-preview.types.js';
import type { FeatureContext } from '../feature.types';

import { getTemplatesDir } from 'utils/package-root.utils';
import { resolveTemplateSourcePath } from 'utils/template-source.utils';
import { applyTemplate } from 'utils/template.utils';

import { proposeAgentsGitignoreMerge, rewriteDotAiPathsToAgents } from '../../lib/agents-gitignore.utils.js';
import {
  collectDotAiMarkdownReferenceUpdates,
  collectLegacyAiFolderMigrationChanges,
} from '../../lib/agents-legacy-ai-folder.utils.js';
import { createWritePreviewChange } from '../../lib/feature-preview/feature-preview.utils.js';
import { previewAiInstructions } from '../ai-instructions/ai-instructions.preview.js';
import { createDefaultTemplateVars } from '../feature.utils';
import { AI_CLAUDE_FILES } from './ai-claude.constants';

async function readPackageVars(targetDir: string): Promise<{ PACKAGE_NAME: string; DESCRIPTION: string }> {
  try {
    const content = await readFile(resolve(targetDir, 'package.json'), 'utf8');
    const pkg = JSON.parse(content) as { name?: string; description?: string };
    return {
      PACKAGE_NAME: pkg.name ?? '',
      DESCRIPTION: pkg.description ?? '',
    };
  } catch {
    return { PACKAGE_NAME: '', DESCRIPTION: '' };
  }
}

/**
 * Preview Claude Code support: optional ai-instructions tree, template files, .gitignore, ESLint.
 */
export async function previewAiClaude(context: FeatureContext): Promise<FeaturePreviewResult> {
  const { targetDir } = context;
  const changes: FeaturePreviewResult['changes'] = [];
  const applied: string[] = [];

  const legacyAiChanges = await collectLegacyAiFolderMigrationChanges(targetDir);
  changes.push(...legacyAiChanges);
  changes.push(...(await collectDotAiMarkdownReferenceUpdates(targetDir)));

  const instructionsDir = resolve(targetDir, '.github/instructions');
  if (!fileExists(instructionsDir)) {
    const sub = await previewAiInstructions(context, { skipAgentsInfrastructure: true });
    changes.push(...sub.changes);
    applied.push(...sub.applied);
  }

  const [claudeFile, memoryFile, settingsFile, handoffFile] = AI_CLAUDE_FILES;

  const claudeDest = resolve(targetDir, claudeFile);
  const memoryDest = resolve(targetDir, memoryFile);
  const settingsDest = resolve(targetDir, settingsFile);
  const handoffDest = resolve(targetDir, handoffFile);

  const handoffWrittenByLegacyMigration = legacyAiChanges.some(
    (c) => c.kind === 'write' && resolve(c.path) === handoffDest,
  );

  const fromDir = fileURLToPath(new URL('.', import.meta.url));
  const templateDir = getTemplatesDir(fromDir);

  const baseVars = createDefaultTemplateVars();
  const pkgVars = await readPackageVars(targetDir);
  const handoffVars = { ...baseVars, ...pkgVars };

  async function templateBody(rel: string, vars: typeof baseVars): Promise<string> {
    const raw = await readFile(resolveTemplateSourcePath(templateDir, rel), 'utf8');
    return applyTemplate(raw, vars);
  }

  {
    const canonical = await templateBody(claudeFile, baseVars);
    const proposed = canonical.endsWith('\n') ? canonical : `${canonical}\n`;
    const current = fileExists(claudeDest) ? await readFile(claudeDest, 'utf8') : '';
    if (proposed !== current) {
      changes.push(createWritePreviewChange(claudeDest, current, proposed, claudeFile));
    } else {
      applied.push(claudeFile);
    }
  }

  if (!fileExists(memoryDest)) {
    const body = await templateBody(memoryFile, baseVars);
    changes.push(createWritePreviewChange(memoryDest, '', body, memoryFile));
  } else {
    applied.push(memoryFile);
  }

  if (!fileExists(settingsDest)) {
    const body = await templateBody(settingsFile, baseVars);
    changes.push(createWritePreviewChange(settingsDest, '', body, settingsFile));
  } else {
    applied.push(settingsFile);
  }

  if (!fileExists(handoffDest) && !handoffWrittenByLegacyMigration) {
    const body = await templateBody(handoffFile, handoffVars);
    changes.push(createWritePreviewChange(handoffDest, '', body, handoffFile));
  } else {
    applied.push(handoffFile);
  }

  const assetsDest = resolve(targetDir, '.claude/assets');
  const assetsGitkeepPath = resolve(targetDir, '.claude/assets/.gitkeep');
  if (!fileExists(assetsDest)) {
    changes.push(createWritePreviewChange(assetsGitkeepPath, '', '\n', '.claude/assets/'));
  } else {
    applied.push('.claude/assets/');
  }

  const gitignorePath = resolve(targetDir, '.gitignore');
  let gitignoreCurrent = '';
  if (fileExists(gitignorePath)) {
    gitignoreCurrent = await readFile(gitignorePath, 'utf8');
  }
  const gitignoreProposed = proposeAgentsGitignoreMerge(rewriteDotAiPathsToAgents(gitignoreCurrent));
  if (gitignoreProposed !== gitignoreCurrent) {
    const out = gitignoreProposed.endsWith('\n') ? gitignoreProposed : `${gitignoreProposed}\n`;
    changes.push(
      createWritePreviewChange(
        gitignorePath,
        gitignoreCurrent,
        out,
        '.gitignore (# Agents, Claude, Codex, worktrees)',
      ),
    );
  } else {
    applied.push('.gitignore (agents)');
  }

  const noopMessage =
    changes.length === 0
      ? 'Claude Code support already matches canonical configuration for owned files.'
      : undefined;

  return { changes, applied, noopMessage };
}
