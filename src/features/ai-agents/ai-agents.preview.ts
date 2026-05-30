import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileExists } from 'utils';
import type { FeaturePreviewResult } from '../../lib/feature-preview/feature-preview.types.js';
import type { FeatureContext } from '../feature.types';
import type { Dirent } from 'node:fs';

import { parseSections } from 'lib/markdown-sections';
import { getTemplatesDir } from 'utils/package-root.utils';
import { resolveTemplateSourcePath } from 'utils/template-source.utils';

import { createWritePreviewChange } from '../../lib/feature-preview/feature-preview.utils.js';
import { mergeAgentsMdFromTemplate, proposeAgentsMdForNewFile } from './ai-agents.agents.utils.js';
import { AI_AGENTS_SKILLS_DIR } from './ai-agents.constants';

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

  let skillEntries: Dirent[];
  try {
    skillEntries = await readdir(skillsTemplateDir, { withFileTypes: true });
  } catch {
    skillEntries = [];
  }

  for (const entry of skillEntries) {
    if (!entry.isDirectory()) continue;

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

  const noopMessage =
    changes.length === 0 ? 'AI agents support already matches canonical configuration.' : undefined;

  return { changes, applied, noopMessage };
}
