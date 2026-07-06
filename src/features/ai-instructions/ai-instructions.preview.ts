import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileExists } from 'utils';
import type { FeaturePreviewResult } from '../../lib/feature-preview/feature-preview.types.js';
import type { FeatureContext } from '../feature.types';

import { getTemplatesDir } from 'utils/package-root.utils';
import { resolveTemplateSourcePath } from 'utils/template-source.utils';
import { applyTemplate } from 'utils/template.utils';

import type { TemplateVars } from 'types/template.types';

import { proposeAgentsGitignoreMerge, rewriteDotAiPathsToAgents } from '../../lib/agents-gitignore.utils.js';
import {
  collectDotAiMarkdownReferenceUpdates,
  collectLegacyAiFolderMigrationChanges,
} from '../../lib/agents-legacy-ai-folder.utils.js';
import {
  createDeletePreviewChange,
  createWritePreviewChange,
} from '../../lib/feature-preview/feature-preview.utils.js';
import { mergeAgentsFromTemplate } from './ai-instructions.agents.utils.js';
import {
  AI_INSTRUCTIONS_AGENTS_MD,
  AI_INSTRUCTIONS_CURSOR_RULES_DIR,
  AI_INSTRUCTIONS_FILES,
  AI_INSTRUCTIONS_SKIP_SUBDIR,
} from './ai-instructions.constants';

const TEMPLATE_EXTENSIONS = ['.json', '.ts', '.md', '.yml', '.yaml', '.mjs', '.js'] as const;
const TEMPLATE_FILES = ['LICENSE'] as const;

async function readTemplatedFileBody(srcPath: string, baseName: string, vars: TemplateVars): Promise<string> {
  const raw = await readFile(srcPath, 'utf8');
  const shouldTemplate =
    TEMPLATE_EXTENSIONS.some((ext) => baseName.endsWith(ext)) ||
    TEMPLATE_FILES.includes(baseName as 'LICENSE');
  return shouldTemplate ? applyTemplate(raw, vars) : raw;
}

/** Template files under `.github/instructions/`, excluding `project/` (never overwritten from genx). */
async function collectInstructionTemplateFiles(
  instructionsTemplateRoot: string,
): Promise<Array<{ rel: string; abs: string }>> {
  const out: Array<{ rel: string; abs: string }> = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.DS_Store') continue;
      if (entry.name === AI_INSTRUCTIONS_SKIP_SUBDIR && entry.isDirectory()) {
        continue;
      }
      const abs = join(dir, entry.name);
      const rel = relative(instructionsTemplateRoot, abs);
      if (entry.isDirectory()) {
        await walk(abs);
      } else {
        out.push({ rel, abs });
      }
    }
  }

  await walk(instructionsTemplateRoot);
  return out.toSorted((a, b) => a.rel.localeCompare(b.rel));
}

/** Template files under `.cursor/rules/`. */
async function collectCursorRuleTemplateFiles(
  cursorRulesTemplateRoot: string,
): Promise<Array<{ rel: string; abs: string }>> {
  const out: Array<{ rel: string; abs: string }> = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.DS_Store') continue;
      const abs = join(dir, entry.name);
      const rel = relative(cursorRulesTemplateRoot, abs);
      if (entry.isDirectory()) {
        await walk(abs);
      } else {
        out.push({ rel, abs });
      }
    }
  }

  if (fileExists(cursorRulesTemplateRoot)) {
    await walk(cursorRulesTemplateRoot);
  }
  return out.toSorted((a, b) => a.rel.localeCompare(b.rel));
}

export interface PreviewAiInstructionsOptions {
  /**
   * When true (e.g. `previewAiClaude` already applied `.ai` → `.agents`, path refs, and `.gitignore`), skip
   * those steps to avoid duplicate preview entries.
   */
  skipAgentsInfrastructure?: boolean;
}

/**
 * Preview AI instructions: Copilot file, `.github/instructions/*.md` (not `project/`), `.cursor/rules/*.mdc`,
 * `AGENTS.md`, ESLint ignores.
 */
export async function previewAiInstructions(
  context: FeatureContext,
  options?: PreviewAiInstructionsOptions,
): Promise<FeaturePreviewResult> {
  const { targetDir } = context;
  const changes: FeaturePreviewResult['changes'] = [];
  const applied: string[] = [];

  const { skipAgentsInfrastructure = false } = options ?? {};

  if (!skipAgentsInfrastructure) {
    changes.push(...(await collectLegacyAiFolderMigrationChanges(targetDir)));
    changes.push(...(await collectDotAiMarkdownReferenceUpdates(targetDir)));
  }

  const fromDir = fileURLToPath(new URL('.', import.meta.url));
  const templateDir = getTemplatesDir(fromDir);

  const vars: TemplateVars = {
    SCOPE: '',
    NAME: '',
    PACKAGE_NAME: '',
    YEAR: new Date().getFullYear().toString(),
    DESCRIPTION: '',
    AUTHOR_NAME: '',
    AUTHOR_EMAIL: '',
  };

  const [copilotFile, instructionsDirRel] = AI_INSTRUCTIONS_FILES;
  const copilotTemplatePath = resolve(templateDir, copilotFile);
  const instructionsTemplateRoot = resolve(templateDir, instructionsDirRel);

  const copilotDest = resolve(targetDir, copilotFile);
  const copilotProposed = await readTemplatedFileBody(copilotTemplatePath, 'copilot-instructions.md', vars);
  let copilotCurrent = '';
  if (fileExists(copilotDest)) {
    copilotCurrent = await readFile(copilotDest, 'utf8');
  }
  if (copilotProposed !== copilotCurrent) {
    changes.push(
      createWritePreviewChange(
        copilotDest,
        copilotCurrent,
        copilotProposed,
        `${copilotFile} (Copilot rules index)`,
      ),
    );
  } else {
    applied.push(copilotFile);
  }

  const instructionFiles = await collectInstructionTemplateFiles(instructionsTemplateRoot);
  const instructionsDestRoot = resolve(targetDir, instructionsDirRel);

  for (const { rel, abs: srcAbs } of instructionFiles) {
    const destPath = join(instructionsDestRoot, rel);
    const baseName = rel.split(/[/\\]/).pop() ?? rel;
    const proposed = await readTemplatedFileBody(srcAbs, baseName, vars);
    let current = '';
    if (fileExists(destPath)) {
      current = await readFile(destPath, 'utf8');
    }
    if (proposed !== current) {
      changes.push(createWritePreviewChange(destPath, current, proposed, join(instructionsDirRel, rel)));
    } else {
      applied.push(join(instructionsDirRel, rel));
    }
  }

  const cursorRulesTemplateRoot = resolve(templateDir, AI_INSTRUCTIONS_CURSOR_RULES_DIR);
  const cursorRuleFiles = await collectCursorRuleTemplateFiles(cursorRulesTemplateRoot);
  const cursorRulesDestRoot = resolve(targetDir, AI_INSTRUCTIONS_CURSOR_RULES_DIR);

  for (const { rel, abs: srcAbs } of cursorRuleFiles) {
    const destPath = join(cursorRulesDestRoot, rel);
    const proposed = await readFile(srcAbs, 'utf8');
    let current = '';
    if (fileExists(destPath)) {
      current = await readFile(destPath, 'utf8');
    }
    if (proposed !== current) {
      changes.push(
        createWritePreviewChange(destPath, current, proposed, join(AI_INSTRUCTIONS_CURSOR_RULES_DIR, rel)),
      );
    } else {
      applied.push(join(AI_INSTRUCTIONS_CURSOR_RULES_DIR, rel));
    }
  }

  const agentsTemplatePath = resolveTemplateSourcePath(templateDir, AI_INSTRUCTIONS_AGENTS_MD);
  const agentsDest = resolve(targetDir, AI_INSTRUCTIONS_AGENTS_MD);
  if (fileExists(agentsTemplatePath)) {
    if (!fileExists(agentsDest)) {
      const body = await readTemplatedFileBody(agentsTemplatePath, AI_INSTRUCTIONS_AGENTS_MD, vars);
      changes.push(
        createWritePreviewChange(agentsDest, '', body, `${AI_INSTRUCTIONS_AGENTS_MD} (from template)`),
      );
    } else {
      const templateAgentsRaw = await readFile(agentsTemplatePath, 'utf8');
      const currentAgents = await readFile(agentsDest, 'utf8');
      const proposedAgents = mergeAgentsFromTemplate(currentAgents, templateAgentsRaw);
      if (proposedAgents !== null) {
        changes.push(
          createWritePreviewChange(
            agentsDest,
            currentAgents,
            proposedAgents,
            `${AI_INSTRUCTIONS_AGENTS_MD} (template base + target extras)`,
          ),
        );
      } else {
        applied.push(AI_INSTRUCTIONS_AGENTS_MD);
      }
    }
  }

  // Delete legacy numbered flat files from the root of .github/instructions/ (e.g. 00-general.instructions.md).
  // These were the old layout; the canonical layout uses subdirectories (code/, naming/, etc.).
  if (fileExists(instructionsDestRoot)) {
    const rootEntries = await readdir(instructionsDestRoot, { withFileTypes: true });
    for (const entry of rootEntries) {
      if (entry.isFile() && /^\d{2}-.*\.instructions\.md$/.test(entry.name)) {
        const legacyPath = join(instructionsDestRoot, entry.name);
        const legacyContent = await readFile(legacyPath, 'utf8');
        changes.push(
          createDeletePreviewChange(
            legacyPath,
            legacyContent,
            true,
            `.github/instructions/${entry.name} (legacy numbered file — replaced by subdirectory layout)`,
          ),
        );
      }
    }
  }

  if (!skipAgentsInfrastructure) {
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
  }

  const noopMessage =
    changes.length === 0
      ? 'AI instructions already match canonical templates (Copilot, instruction files, Cursor rules, AGENTS.md, ESLint).'
      : undefined;

  return { changes, applied, noopMessage };
}
