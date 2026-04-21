import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileExists } from 'utils';
import type { FeaturePreviewResult } from '../../lib/feature-preview/feature-preview.types.js';
import type { FeatureContext } from '../feature.types';

import { getTemplatesDir } from 'utils/package-root.utils';
import { resolveTemplateSourcePath } from 'utils/template-source.utils';
import { applyTemplate } from 'utils/template.utils';

import {
  createDeletePreviewChange,
  createWritePreviewChange,
} from '../../lib/feature-preview/feature-preview.utils.js';
import { AI_INSTRUCTIONS_ESLINT_IGNORES } from '../ai-instructions/ai-instructions.constants';
import { previewAiInstructions } from '../ai-instructions/ai-instructions.preview.js';
import { createDefaultTemplateVars, proposeEslintIgnorePatterns } from '../feature.utils';
import { AI_CLAUDE_ESLINT_IGNORES, AI_CLAUDE_FILES, AI_CLAUDE_GITIGNORE_LINES } from './ai-claude.constants';
import { appendMigratedClaudeHandoff } from './ai-claude.handoff.utils.js';

const LEGACY_CLAUDE_HANDOFF = '.claude/handoff.md' as const;

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

function proposeGitignoreWithClaudeLines(content: string): string {
  const missingLines = AI_CLAUDE_GITIGNORE_LINES.filter((line) => !content.includes(line));
  if (missingLines.length === 0) {
    return content;
  }
  const linesToAdd = missingLines.join('\n');
  return content.endsWith('\n') ? `${content}${linesToAdd}\n` : `${content}\n${linesToAdd}\n`;
}

/**
 * Preview Claude Code support: optional ai-instructions tree, template files, .gitignore, ESLint.
 */
export async function previewAiClaude(context: FeatureContext): Promise<FeaturePreviewResult> {
  const { targetDir } = context;
  const changes: FeaturePreviewResult['changes'] = [];
  const applied: string[] = [];

  const instructionsDir = resolve(targetDir, '.github/instructions');
  if (!fileExists(instructionsDir)) {
    const sub = await previewAiInstructions(context);
    for (const c of sub.changes) {
      if (c.kind === 'write' && c.path.endsWith('eslint.config.ts')) {
        continue;
      }
      changes.push(c);
    }
    applied.push(...sub.applied);
  }

  const [claudeFile, memoryFile, settingsFile, handoffFile] = AI_CLAUDE_FILES;

  const claudeDest = resolve(targetDir, claudeFile);
  const memoryDest = resolve(targetDir, memoryFile);
  const settingsDest = resolve(targetDir, settingsFile);
  const handoffDest = resolve(targetDir, handoffFile);

  const fromDir = fileURLToPath(new URL('.', import.meta.url));
  const templateDir = getTemplatesDir(fromDir);

  const baseVars = createDefaultTemplateVars();
  const pkgVars = await readPackageVars(targetDir);
  const handoffVars = { ...baseVars, ...pkgVars };

  async function templateBody(rel: string, vars: typeof baseVars): Promise<string> {
    const raw = await readFile(resolveTemplateSourcePath(templateDir, rel), 'utf8');
    return applyTemplate(raw, vars);
  }

  if (!fileExists(claudeDest)) {
    const body = await templateBody(claudeFile, baseVars);
    changes.push(createWritePreviewChange(claudeDest, '', body, claudeFile));
  } else {
    applied.push(claudeFile);
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

  const legacyHandoffPath = resolve(targetDir, LEGACY_CLAUDE_HANDOFF);
  if (!fileExists(handoffDest)) {
    if (fileExists(legacyHandoffPath)) {
      const templated = await templateBody(handoffFile, handoffVars);
      const legacyRaw = await readFile(legacyHandoffPath, 'utf8');
      const mergedHandoff = appendMigratedClaudeHandoff(templated, legacyRaw);
      changes.push(
        createWritePreviewChange(
          handoffDest,
          '',
          mergedHandoff,
          `${handoffFile} (migrated from ${LEGACY_CLAUDE_HANDOFF})`,
        ),
      );
      changes.push(
        createDeletePreviewChange(
          legacyHandoffPath,
          legacyRaw,
          true,
          `${LEGACY_CLAUDE_HANDOFF} (merged into ${handoffFile})`,
        ),
      );
    } else {
      const body = await templateBody(handoffFile, handoffVars);
      changes.push(createWritePreviewChange(handoffDest, '', body, handoffFile));
    }
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
  const gitignoreProposed = proposeGitignoreWithClaudeLines(gitignoreCurrent);
  if (gitignoreProposed !== gitignoreCurrent) {
    const out = gitignoreProposed.endsWith('\n') ? gitignoreProposed : `${gitignoreProposed}\n`;
    changes.push(
      createWritePreviewChange(gitignorePath, gitignoreCurrent, out, '.gitignore (.claude entries)'),
    );
  } else {
    applied.push('.gitignore (.claude)');
  }

  const eslintPath = resolve(targetDir, 'eslint.config.ts');
  if (fileExists(eslintPath)) {
    const eslintRaw = await readFile(eslintPath, 'utf8');
    let proposed: string;
    if (fileExists(instructionsDir)) {
      proposed = proposeEslintIgnorePatterns(eslintRaw, AI_CLAUDE_ESLINT_IGNORES);
    } else {
      proposed = proposeEslintIgnorePatterns(eslintRaw, AI_INSTRUCTIONS_ESLINT_IGNORES);
      proposed = proposeEslintIgnorePatterns(proposed, AI_CLAUDE_ESLINT_IGNORES);
    }
    if (proposed !== eslintRaw) {
      const out = proposed.endsWith('\n') ? proposed : `${proposed}\n`;
      changes.push(createWritePreviewChange(eslintPath, eslintRaw, out, 'eslint.config.ts (.claude ignore)'));
    } else {
      applied.push('eslint.config.ts (.claude)');
    }
  }

  const noopMessage =
    changes.length === 0
      ? 'Claude Code support already matches canonical configuration for owned files.'
      : undefined;

  return { changes, applied, noopMessage };
}
