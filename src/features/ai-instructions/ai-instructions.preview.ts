import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileExists } from 'utils';
import type { FeaturePreviewResult } from '../../lib/feature-preview/feature-preview.types.js';
import type { FeatureContext } from '../feature.types';

import { getTemplatesDir } from 'utils/package-root.utils';
import { applyTemplate } from 'utils/template.utils';
import type { TemplateVars } from 'types/template.types';
import { createWritePreviewChange } from '../../lib/feature-preview/feature-preview.utils.js';
import { proposeEslintIgnorePatterns } from '../feature.utils';
import { AI_INSTRUCTIONS_ESLINT_IGNORES, AI_INSTRUCTIONS_FILES } from './ai-instructions.constants';

const TEMPLATE_EXTENSIONS = ['.json', '.ts', '.md', '.yml', '.yaml', '.mjs', '.js'] as const;
const TEMPLATE_FILES = ['LICENSE'] as const;

async function readTemplatedFileBody(srcPath: string, baseName: string, vars: TemplateVars): Promise<string> {
  const raw = await readFile(srcPath, 'utf8');
  const shouldTemplate =
    TEMPLATE_EXTENSIONS.some((ext) => baseName.endsWith(ext)) ||
    TEMPLATE_FILES.includes(baseName as 'LICENSE');
  return shouldTemplate ? applyTemplate(raw, vars) : raw;
}

async function collectDirWrites(
  templateSrcRoot: string,
  destRoot: string,
  vars: TemplateVars,
): Promise<Array<{ dest: string; body: string }>> {
  const out: Array<{ dest: string; body: string }> = [];

  async function walk(currentSrc: string, currentDest: string): Promise<void> {
    const entries = await readdir(currentSrc, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = join(currentSrc, entry.name);
      const destPath = join(currentDest, entry.name);
      if (entry.isDirectory()) {
        await walk(srcPath, destPath);
      } else if (entry.isFile()) {
        const body = await readTemplatedFileBody(srcPath, entry.name, vars);
        out.push({ dest: destPath, body });
      }
    }
  }

  await walk(templateSrcRoot, destRoot);
  return out;
}

/**
 * Preview AI instructions: Copilot file, instructions + cursor dirs, ESLint ignores.
 */
export async function previewAiInstructions(context: FeatureContext): Promise<FeaturePreviewResult> {
  const { targetDir } = context;
  const changes: FeaturePreviewResult['changes'] = [];
  const applied: string[] = [];

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

  const [copilotFile, instructionsDir, cursorDir] = AI_INSTRUCTIONS_FILES;

  const copilotDest = resolve(targetDir, copilotFile);
  if (!fileExists(copilotDest)) {
    const body = await readTemplatedFileBody(
      resolve(templateDir, copilotFile),
      'copilot-instructions.md',
      vars,
    );
    changes.push(createWritePreviewChange(copilotDest, '', body, copilotFile));
  } else {
    applied.push(copilotFile);
  }

  const instructionsDest = resolve(targetDir, instructionsDir);
  if (!fileExists(instructionsDest)) {
    const srcRoot = resolve(templateDir, instructionsDir);
    const files = await collectDirWrites(srcRoot, instructionsDest, vars);
    for (const { dest, body } of files) {
      const rel = relative(targetDir, dest);
      changes.push(createWritePreviewChange(dest, '', body, rel));
    }
  } else {
    applied.push(instructionsDir);
  }

  const cursorDest = resolve(targetDir, cursorDir);
  if (!fileExists(cursorDest)) {
    const srcRoot = resolve(templateDir, cursorDir);
    const files = await collectDirWrites(srcRoot, cursorDest, vars);
    for (const { dest, body } of files) {
      const rel = relative(targetDir, dest);
      changes.push(createWritePreviewChange(dest, '', body, rel));
    }
  } else {
    applied.push(cursorDir);
  }

  const eslintPath = resolve(targetDir, 'eslint.config.ts');
  if (fileExists(eslintPath)) {
    const eslintRaw = await readFile(eslintPath, 'utf8');
    const proposed = proposeEslintIgnorePatterns(eslintRaw, AI_INSTRUCTIONS_ESLINT_IGNORES);
    if (proposed !== eslintRaw) {
      const out = proposed.endsWith('\n') ? proposed : `${proposed}\n`;
      changes.push(createWritePreviewChange(eslintPath, eslintRaw, out, 'eslint.config.ts (.cursor ignore)'));
    } else {
      applied.push('eslint.config.ts (cursor ignore)');
    }
  }

  const noopMessage =
    changes.length === 0
      ? 'AI instructions already match canonical configuration for owned files.'
      : undefined;

  return { changes, applied, noopMessage };
}
