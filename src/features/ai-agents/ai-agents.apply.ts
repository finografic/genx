import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { confirmFileWrite, createDiffConfirmState } from 'core/file-diff';
import { copyDir, ensureDir, errorMessage, fileExists, successMessage, successUpdatedMessage } from 'utils';
import type { FeatureApplyResult, FeatureContext } from '../feature.types';
import type { Dirent } from 'node:fs';

import {
  findSectionIndex,
  hasSection,
  parseSections,
  reorderSections,
  serializeSections,
  setSection,
} from 'lib/markdown-sections';
import { getTemplatesDir } from 'utils/package-root.utils';
import {
  AI_AGENTS_ALL_CANONICAL_HEADINGS,
  AI_AGENTS_ENFORCED_HEADINGS,
  AI_AGENTS_SEEDED_HEADINGS,
  AI_AGENTS_SKILLS_DIR,
} from './ai-agents.constants';

/**
 * Apply the ai-agents feature to a target project.
 *
 * 1. Scaffold or sync `AGENTS.md` with the four canonical sections from
 *    `_templates/AGENTS.md`.
 * 2. Copy agent skill procedures into `.github/skills/`.
 */
export async function applyAiAgents(context: FeatureContext): Promise<FeatureApplyResult> {
  const applied: string[] = [];
  const { targetDir } = context;

  const fromDir = fileURLToPath(new URL('.', import.meta.url));
  const templateDir = getTemplatesDir(fromDir);

  // ── 1. AGENTS.md ────────────────────────────────────────────────────────────

  const templateAgentsPath = resolve(templateDir, 'AGENTS.md');
  const agentsPath = resolve(targetDir, 'AGENTS.md');

  let templateContent: string;
  try {
    templateContent = await readFile(templateAgentsPath, 'utf8');
  } catch {
    errorMessage('Could not read _templates/AGENTS.md — skipping AGENTS.md step');
    return { applied, error: new Error('Missing _templates/AGENTS.md') };
  }

  const templateParsed = parseSections(templateContent);

  if (!fileExists(agentsPath)) {
    // New project — scaffold from template
    await writeFile(agentsPath, templateContent, 'utf8');
    applied.push('AGENTS.md');
    successMessage('Created AGENTS.md');
  } else {
    // Existing file — sync enforced sections, seed missing seeded sections
    const currentContent = await readFile(agentsPath, 'utf8');
    let parsed = parseSections(currentContent);
    let changed = false;

    // Seeded sections: insert if absent, never update
    for (const heading of AI_AGENTS_SEEDED_HEADINGS) {
      if (!hasSection(parsed, heading)) {
        const templateSection = templateParsed.sections.find((s) => s.heading === `## ${heading}`);
        if (templateSection) {
          parsed = setSection(parsed, heading, templateSection.body);
          changed = true;
        }
      }
    }

    // Enforced sections: insert if absent OR update if body diverged from template
    for (const heading of AI_AGENTS_ENFORCED_HEADINGS) {
      const templateSection = templateParsed.sections.find((s) => s.heading === `## ${heading}`);
      if (!templateSection) continue;

      const idx = findSectionIndex(parsed, heading);
      if (idx === -1) {
        parsed = setSection(parsed, heading, templateSection.body);
        changed = true;
      } else if (parsed.sections[idx]?.body !== templateSection.body) {
        parsed = setSection(parsed, heading, templateSection.body);
        changed = true;
      }
    }

    // Enforce canonical section order (seeded then enforced, other sections follow)
    const reordered = reorderSections(parsed, [...AI_AGENTS_ALL_CANONICAL_HEADINGS]);
    if (reordered.sections.some((s, i) => s.heading !== parsed.sections[i]?.heading)) {
      parsed = reordered;
      changed = true;
    }

    if (changed) {
      const diffState = createDiffConfirmState();
      const proposed = serializeSections(parsed);
      const action = await confirmFileWrite(agentsPath, currentContent, proposed, diffState);

      if (action !== 'skip') {
        await writeFile(agentsPath, proposed, 'utf8');
        applied.push('AGENTS.md');
        successUpdatedMessage('Updated AGENTS.md');
      }
    }
  }

  // ── 2. .github/skills/ ───────────────────────────────────────────────────────

  const skillsTemplateDir = resolve(templateDir, AI_AGENTS_SKILLS_DIR);
  const skillsTargetDir = resolve(targetDir, AI_AGENTS_SKILLS_DIR);

  await ensureDir(skillsTargetDir);

  let skillEntries: Dirent<string>[];
  try {
    skillEntries = await readdir(skillsTemplateDir, { withFileTypes: true, encoding: 'utf8' });
  } catch {
    // No skills in template — skip silently
    skillEntries = [];
  }

  for (const entry of skillEntries) {
    if (!entry.isDirectory()) continue;

    const skillDest = resolve(skillsTargetDir, entry.name);
    if (fileExists(skillDest)) continue;

    const skillSrc = resolve(skillsTemplateDir, entry.name);
    await copyDir(skillSrc, skillDest, {});
    applied.push(`.github/skills/${entry.name}/`);
    successMessage(`Created .github/skills/${entry.name}/`);
  }

  if (applied.length === 0) {
    return { applied, noopMessage: 'AI agents support already configured. No changes made.' };
  }

  return { applied };
}
