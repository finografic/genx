import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { copyDir, copyTemplate, errorMessage, fileExists, spinner, successMessage } from 'utils';
import { getTemplatesDir } from 'utils/package-root.utils';
import type { FeatureApplyResult, FeatureContext } from '../feature.types';
import { addEslintIgnorePatterns, createDefaultTemplateVars } from '../feature.utils';
import { AI_INSTRUCTIONS_ESLINT_IGNORES, AI_INSTRUCTIONS_FILES } from './ai-instructions.constants';

/**
 * Apply AI Instructions feature to an existing package.
 * Copies Copilot instructions, GitHub instructions, and Cursor rules from template.
 */
export async function applyAiInstructions(context: FeatureContext): Promise<FeatureApplyResult> {
  const applied: string[] = [];

  const [copilotFile, instructionsDir, cursorDir] = AI_INSTRUCTIONS_FILES;

  const copilotDest = resolve(context.targetDir, copilotFile);
  const instructionsDest = resolve(context.targetDir, instructionsDir);
  const cursorDest = resolve(context.targetDir, cursorDir);

  const copilotExists = fileExists(copilotDest);
  const instructionsExist = fileExists(instructionsDest);
  const cursorExists = fileExists(cursorDest);

  if (copilotExists && instructionsExist && cursorExists) {
    // Ensure eslint ignore even if all files exist
    const eslintAdded = await addEslintIgnorePatterns(
      context.targetDir,
      AI_INSTRUCTIONS_ESLINT_IGNORES,
    );
    if (eslintAdded.length > 0) {
      applied.push('eslint.config.ts (.cursor ignore)');
      successMessage('Added **/.cursor/** to eslint.config.ts ignores');
    }

    if (applied.length === 0) {
      return { applied, noopMessage: 'AI instructions already installed. No changes made.' };
    }
    return { applied };
  }

  const templateVars = createDefaultTemplateVars();

  const fromDir = fileURLToPath(new URL('.', import.meta.url));
  const templateDir = getTemplatesDir(fromDir);

  const copySpin = spinner();
  copySpin.start('Copying AI instructions...');

  try {
    // 1. Copy .github/copilot-instructions.md
    if (!copilotExists) {
      await copyTemplate(resolve(templateDir, copilotFile), copilotDest, templateVars);
      applied.push(copilotFile);
    }

    // 2. Copy .github/instructions/ directory
    if (!instructionsExist) {
      await copyDir(resolve(templateDir, instructionsDir), instructionsDest, templateVars);
      applied.push(instructionsDir);
    }

    // 3. Copy .cursor/rules/ directory
    if (!cursorExists) {
      await copyDir(resolve(templateDir, cursorDir), cursorDest, templateVars);
      applied.push(cursorDir);
    }

    copySpin.stop('AI instructions copied');

    for (const item of applied) {
      successMessage(`Created ${item}`);
    }
  } catch (err) {
    copySpin.stop('Failed to copy AI instructions');
    const error = err instanceof Error ? err : new Error('Unknown error');
    errorMessage(error.message);
    return { applied, error };
  }

  // 4. Add .cursor ignore to eslint.config.ts
  const eslintAdded = await addEslintIgnorePatterns(
    context.targetDir,
    AI_INSTRUCTIONS_ESLINT_IGNORES,
  );
  if (eslintAdded.length > 0) {
    applied.push('eslint.config.ts (.cursor ignore)');
    successMessage('Added **/.cursor/** to eslint.config.ts ignores');
  }

  return { applied };
}
