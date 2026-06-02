import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileExists } from 'utils';
import type { FeaturePreviewResult } from '../../lib/feature-preview/feature-preview.types.js';
import type { FeatureContext } from '../feature.types';
import type { Dirent } from 'node:fs';

import { parseSections } from 'lib/markdown-sections';
import { isPackageType } from 'lib/package-type.utils';
import { getTemplatesDir } from 'utils/package-root.utils';
import { resolveTemplateSourcePath } from 'utils/template-source.utils';

import type { PackageJson } from 'types/package-json.types';

import {
  createDeletePreviewChange,
  createWritePreviewChange,
} from '../../lib/feature-preview/feature-preview.utils.js';
import { mergeAgentsMdFromTemplate, proposeAgentsMdForNewFile } from './ai-agents.agents.utils.js';
import {
  AI_AGENTS_CLI_ONLY_SKILL_DIRS,
  AI_AGENTS_REMOVED_SKILL_DIRS,
  AI_AGENTS_SKILLS_DIR,
} from './ai-agents.constants';

async function collectSkillTreeWrites(
  templateSkillDir: string,
  destSkillDir: string,
  targetDir: string,
): Promise<Array<{ dest: string; body: string; label: string }>> {
  const out: Array<{ dest: string; body: string; label: string }> = [];

  async function walk(currentSrc: string, currentDest: string): Promise<void> {
    const entries = await readdir(currentSrc, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = join(currentSrc, entry.name);
      const destPath = join(currentDest, entry.name);
      if (entry.isDirectory()) {
        await walk(srcPath, destPath);
      } else if (entry.isFile()) {
        const body = await readFile(srcPath, 'utf8');
        const rel = relative(targetDir, destPath);
        out.push({ dest: destPath, body, label: rel });
      }
    }
  }

  await walk(templateSkillDir, destSkillDir);
  return out;
}

async function collectSkillTreeDeletes(
  skillDir: string,
  targetDir: string,
): Promise<Array<{ dest: string; body: string; label: string }>> {
  if (!fileExists(skillDir)) return [];

  const out: Array<{ dest: string; body: string; label: string }> = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const destPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(destPath);
      } else if (entry.isFile()) {
        const body = await readFile(destPath, 'utf8');
        const rel = relative(targetDir, destPath);
        out.push({ dest: destPath, body, label: rel });
      }
    }
  }

  await walk(skillDir);
  return out;
}

/**
 * Preview ai-agents: `AGENTS.md` sync + scaffold `.github/skills/*` when missing.
 */
export async function previewAiAgents(context: FeatureContext): Promise<FeaturePreviewResult> {
  const { targetDir } = context;
  const changes: FeaturePreviewResult['changes'] = [];
  const applied: string[] = [];

  const fromDir = fileURLToPath(new URL('.', import.meta.url));
  const templateDir = getTemplatesDir(fromDir);

  const templateAgentsPath = resolveTemplateSourcePath(templateDir, 'AGENTS.md');
  let templateContent: string;
  try {
    templateContent = await readFile(templateAgentsPath, 'utf8');
  } catch {
    throw new Error('Missing _templates/AGENTS.md.template');
  }

  const templateParsed = parseSections(templateContent);
  const agentsPath = resolve(targetDir, 'AGENTS.md');

  if (!fileExists(agentsPath)) {
    changes.push(
      createWritePreviewChange(
        agentsPath,
        '',
        proposeAgentsMdForNewFile(templateContent, templateParsed),
        'AGENTS.md',
      ),
    );
  } else {
    const currentContent = await readFile(agentsPath, 'utf8');
    const proposed = mergeAgentsMdFromTemplate(currentContent, { templateParsed });
    if (proposed !== null) {
      changes.push(createWritePreviewChange(agentsPath, currentContent, proposed, 'AGENTS.md'));
    } else {
      applied.push('AGENTS.md');
    }
  }

  const skillsTemplateDir = resolve(templateDir, AI_AGENTS_SKILLS_DIR);
  const skillsTargetDir = resolve(targetDir, AI_AGENTS_SKILLS_DIR);
  const packageJson = JSON.parse(await readFile(resolve(targetDir, 'package.json'), 'utf8')) as PackageJson;
  const isCliPackage = isPackageType(packageJson, 'cli');
  const cliOnlySkillDirs = new Set<string>(AI_AGENTS_CLI_ONLY_SKILL_DIRS);
  const removedSkillDirs = new Set<string>(AI_AGENTS_REMOVED_SKILL_DIRS);
  const skillDirsToRemove = [
    ...AI_AGENTS_REMOVED_SKILL_DIRS,
    ...(!isCliPackage ? AI_AGENTS_CLI_ONLY_SKILL_DIRS : []),
  ];

  let skillEntries: Dirent[];
  try {
    skillEntries = await readdir(skillsTemplateDir, { withFileTypes: true });
  } catch {
    skillEntries = [];
  }

  for (const entry of skillEntries) {
    if (!entry.isDirectory()) continue;
    if (removedSkillDirs.has(entry.name) || (!isCliPackage && cliOnlySkillDirs.has(entry.name))) {
      continue;
    }

    const skillDest = resolve(skillsTargetDir, entry.name);
    if (fileExists(skillDest)) {
      applied.push(`.github/skills/${entry.name}/`);
      continue;
    }

    const skillSrc = resolve(skillsTemplateDir, entry.name);
    const files = await collectSkillTreeWrites(skillSrc, skillDest, targetDir);
    for (const { dest, body, label } of files) {
      changes.push(createWritePreviewChange(dest, '', body, label));
    }
  }

  for (const skillDir of skillDirsToRemove) {
    const files = await collectSkillTreeDeletes(resolve(skillsTargetDir, skillDir), targetDir);
    for (const { dest, body, label } of files) {
      changes.push(createDeletePreviewChange(dest, body, true, `${label} (not applicable)`));
    }
  }

  const noopMessage =
    changes.length === 0 ? 'AI agents support already matches canonical configuration.' : undefined;

  return { changes, applied, noopMessage };
}
