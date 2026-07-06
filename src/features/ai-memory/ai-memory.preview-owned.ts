import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileExists } from 'utils';
import type { FeaturePreviewResult } from '../../lib/feature-preview/feature-preview.types.js';
import type { FeatureContext } from '../feature.types';

import { getTemplatesDir } from 'utils/package-root.utils';
import { resolveTemplateSourcePath } from 'utils/template-source.utils';
import { applyTemplate } from 'utils/template.utils';

import { proposeGitignoreMerge, rewriteDotAiPathsToAgents } from '../../lib/agents-gitignore.utils.js';
import {
  collectDotAiMarkdownReferenceUpdates,
  collectLegacyAiFolderMigrationChanges,
} from '../../lib/agents-legacy-ai-folder.utils.js';
import {
  isMigratableClaudeMemoryContent,
  isMinimalClaudeMdContent,
  mergeClaudeHandoffIntoAgentsHandoff,
  mergeClaudeMemoryIntoAgentsMemory,
  stripLegacyClaudeImportHeadings,
  updateHandoffMaintenanceNote,
} from '../../lib/ai-memory.utils.js';
import {
  createDeletePreviewChange,
  createWritePreviewChange,
} from '../../lib/feature-preview/feature-preview.utils.js';
import { createDefaultTemplateVars } from '../feature.utils';
import { AI_MEMORY_LEGACY_PATHS } from './ai-memory.constants';

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

async function templateBody(templateDir: string, rel: string, vars: Record<string, string>): Promise<string> {
  const raw = await readFile(resolveTemplateSourcePath(templateDir, rel), 'utf8');
  return applyTemplate(raw, vars);
}

function normalizeNewline(content: string): string {
  return content.endsWith('\n') ? content : `${content}\n`;
}

/**
 * Preview owned ai-memory file changes (excluding ai-agents / ai-instructions dependency previews).
 */
export async function previewAiMemoryOwnedFiles(context: FeatureContext): Promise<FeaturePreviewResult> {
  const { targetDir } = context;
  const changes: FeaturePreviewResult['changes'] = [];
  const applied: string[] = [];

  const legacyAiChanges = await collectLegacyAiFolderMigrationChanges(targetDir);
  changes.push(...legacyAiChanges);
  changes.push(...(await collectDotAiMarkdownReferenceUpdates(targetDir)));

  const fromDir = fileURLToPath(new URL('.', import.meta.url));
  const templateDir = getTemplatesDir(fromDir);
  const baseVars = createDefaultTemplateVars();
  const handoffVars = { ...baseVars, ...(await readPackageVars(targetDir)) };

  const createOnlyPaths = [
    'docs/process/PROJECT_MEMORY_MODEL.md',
    'docs/todo/ROADMAP.md',
    'docs/todo/NEXT_STEPS.md',
  ] as const;

  for (const rel of createOnlyPaths) {
    const dest = resolve(targetDir, rel);
    if (fileExists(dest)) {
      applied.push(rel);
      continue;
    }
    const body = await templateBody(templateDir, rel, baseVars);
    changes.push(createWritePreviewChange(dest, '', body, rel));
  }

  const [legacyMemoryRel, legacyHandoffRel] = AI_MEMORY_LEGACY_PATHS;
  const legacyMemoryPath = resolve(targetDir, legacyMemoryRel);
  const legacyHandoffPath = resolve(targetDir, legacyHandoffRel);
  const agentsHandoffPath = resolve(targetDir, '.agents/handoff.md');
  const agentsMemoryPath = resolve(targetDir, '.agents/memory.md');

  let legacyMemoryContent = '';
  if (fileExists(legacyMemoryPath)) {
    legacyMemoryContent = await readFile(legacyMemoryPath, 'utf8');
  }

  let legacyHandoffContent = '';
  if (fileExists(legacyHandoffPath)) {
    legacyHandoffContent = await readFile(legacyHandoffPath, 'utf8');
  }

  const handoffWrittenByLegacyMigration = legacyAiChanges.some(
    (c) => c.kind === 'write' && resolve(c.path) === agentsHandoffPath,
  );

  if (!fileExists(agentsHandoffPath) && !handoffWrittenByLegacyMigration) {
    let body = await templateBody(templateDir, '.agents/handoff.md', handoffVars);
    if (legacyHandoffContent.trim().length > 0) {
      body = mergeClaudeHandoffIntoAgentsHandoff(body, legacyHandoffContent);
    }
    changes.push(createWritePreviewChange(agentsHandoffPath, '', body, '.agents/handoff.md'));
  } else if (fileExists(agentsHandoffPath)) {
    const current = await readFile(agentsHandoffPath, 'utf8');
    let proposed = stripLegacyClaudeImportHeadings(current);

    if (legacyHandoffContent.trim().length > 0) {
      proposed = mergeClaudeHandoffIntoAgentsHandoff(proposed, legacyHandoffContent);
    }

    const maintenance = updateHandoffMaintenanceNote(proposed);
    if (maintenance !== null) {
      proposed = maintenance;
    }

    if (proposed !== current) {
      changes.push(
        createWritePreviewChange(
          agentsHandoffPath,
          current,
          normalizeNewline(proposed),
          '.agents/handoff.md',
        ),
      );
    } else {
      applied.push('.agents/handoff.md');
    }
  }

  if (legacyHandoffContent.trim().length > 0 && fileExists(legacyHandoffPath)) {
    changes.push(
      createDeletePreviewChange(
        legacyHandoffPath,
        legacyHandoffContent,
        true,
        '.claude/handoff.md (migrated to .agents/handoff.md)',
      ),
    );
  }

  if (!fileExists(agentsMemoryPath)) {
    let body = await templateBody(templateDir, '.agents/memory.md', baseVars);
    if (isMigratableClaudeMemoryContent(legacyMemoryContent)) {
      body = mergeClaudeMemoryIntoAgentsMemory(body, legacyMemoryContent);
    }
    changes.push(createWritePreviewChange(agentsMemoryPath, '', body, '.agents/memory.md'));
  } else {
    const current = await readFile(agentsMemoryPath, 'utf8');
    const withoutLegacyHeading = stripLegacyClaudeImportHeadings(current);
    if (isMigratableClaudeMemoryContent(legacyMemoryContent)) {
      const proposed = mergeClaudeMemoryIntoAgentsMemory(withoutLegacyHeading, legacyMemoryContent);
      if (proposed !== current) {
        changes.push(
          createWritePreviewChange(
            agentsMemoryPath,
            current,
            normalizeNewline(proposed),
            '.agents/memory.md (import legacy Claude memory)',
          ),
        );
      } else {
        applied.push('.agents/memory.md');
      }
    } else if (withoutLegacyHeading !== current) {
      changes.push(
        createWritePreviewChange(
          agentsMemoryPath,
          current,
          normalizeNewline(withoutLegacyHeading),
          '.agents/memory.md (remove legacy import heading)',
        ),
      );
    } else {
      applied.push('.agents/memory.md');
    }
  }

  const claudeMdPath = resolve(targetDir, 'CLAUDE.md');
  const canonicalClaude = normalizeNewline(await templateBody(templateDir, 'CLAUDE.md', baseVars));
  if (!fileExists(claudeMdPath)) {
    changes.push(createWritePreviewChange(claudeMdPath, '', canonicalClaude, 'CLAUDE.md'));
  } else {
    const current = await readFile(claudeMdPath, 'utf8');
    if (!isMinimalClaudeMdContent(current) || current !== canonicalClaude) {
      changes.push(createWritePreviewChange(claudeMdPath, current, canonicalClaude, 'CLAUDE.md'));
    } else {
      applied.push('CLAUDE.md');
    }
  }

  if (fileExists(legacyMemoryPath)) {
    changes.push(
      createDeletePreviewChange(
        legacyMemoryPath,
        legacyMemoryContent,
        true,
        '.claude/memory.md (migrated to .agents/memory.md)',
      ),
    );
  }

  const gitignorePath = resolve(targetDir, '.gitignore');
  let gitignoreCurrent = '';
  if (fileExists(gitignorePath)) {
    gitignoreCurrent = await readFile(gitignorePath, 'utf8');
  }
  const gitignoreProposed = proposeGitignoreMerge(rewriteDotAiPathsToAgents(gitignoreCurrent));
  if (gitignoreProposed !== gitignoreCurrent) {
    changes.push(
      createWritePreviewChange(
        gitignorePath,
        gitignoreCurrent,
        normalizeNewline(gitignoreProposed),
        '.gitignore (canonical)',
      ),
    );
  } else {
    applied.push('.gitignore');
  }

  return { changes, applied };
}
