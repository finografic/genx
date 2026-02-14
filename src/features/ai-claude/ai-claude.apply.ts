import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { copyTemplate, errorMessage, fileExists, spinner, successMessage } from 'utils';
import { getTemplatesDir } from 'utils/package-root.utils';
import { applyAiInstructions } from '../ai-instructions/ai-instructions.apply';
import type { FeatureApplyResult, FeatureContext } from '../feature.types';
import { AI_CLAUDE_FILES, AI_CLAUDE_GITIGNORE_LINES } from './ai-claude.constants';

/**
 * Ensure .gitignore contains the required .claude/ entries.
 * Appends missing lines; does not duplicate existing ones.
 */
async function ensureGitignoreLines(targetDir: string): Promise<boolean> {
  const gitignorePath = resolve(targetDir, '.gitignore');

  let content = '';
  if (fileExists(gitignorePath)) {
    content = await readFile(gitignorePath, 'utf8');
  }

  const missingLines = AI_CLAUDE_GITIGNORE_LINES.filter(
    (line) => !content.includes(line),
  );

  if (missingLines.length === 0) {
    return false;
  }

  const linesToAdd = missingLines.join('\n');
  const updatedContent = content.endsWith('\n')
    ? `${content}${linesToAdd}\n`
    : `${content}\n${linesToAdd}\n`;

  await writeFile(gitignorePath, updatedContent, 'utf8');
  return true;
}

/**
 * Apply AI Claude feature to an existing package.
 * Installs CLAUDE.md, .claude/memory.md, .claude/settings.json,
 * ensures .gitignore entries, and auto-installs ai-instructions if missing.
 */
export async function applyAiClaude(context: FeatureContext): Promise<FeatureApplyResult> {
  const applied: string[] = [];

  // Auto-dependency: ensure .github/instructions/ exists (CLAUDE.md references them)
  const instructionsDir = resolve(context.targetDir, '.github/instructions');
  if (!existsSync(instructionsDir)) {
    const instructionsResult = await applyAiInstructions(context);
    if (instructionsResult.error) {
      return { applied, error: instructionsResult.error };
    }
    if (instructionsResult.applied.length > 0) {
      applied.push(...instructionsResult.applied);
    }
  }

  const [claudeFile, memoryFile, settingsFile] = AI_CLAUDE_FILES;

  const claudeDest = resolve(context.targetDir, claudeFile);
  const memoryDest = resolve(context.targetDir, memoryFile);
  const settingsDest = resolve(context.targetDir, settingsFile);

  const claudeExists = fileExists(claudeDest);
  const memoryExists = fileExists(memoryDest);
  const settingsExists = fileExists(settingsDest);

  if (claudeExists && memoryExists && settingsExists) {
    // Ensure .gitignore even if all files exist
    const gitignoreUpdated = await ensureGitignoreLines(context.targetDir);
    if (gitignoreUpdated) {
      applied.push('.gitignore (.claude entries)');
      successMessage('Added .claude entries to .gitignore');
    }

    if (applied.length === 0) {
      return { applied, noopMessage: 'Claude Code support already installed. No changes made.' };
    }
    return { applied };
  }

  // Get template directory
  const fromDir = fileURLToPath(new URL('.', import.meta.url));
  const templateDir = getTemplatesDir(fromDir);

  const templateVars = {
    SCOPE: '',
    NAME: '',
    PACKAGE_NAME: '',
    YEAR: new Date().getFullYear().toString(),
    DESCRIPTION: '',
    AUTHOR_NAME: '',
    AUTHOR_EMAIL: '',
  };

  const copySpin = spinner();
  copySpin.start('Installing Claude Code support...');

  try {
    // Copy CLAUDE.md
    if (!claudeExists) {
      await copyTemplate(resolve(templateDir, claudeFile), claudeDest, templateVars);
      applied.push(claudeFile);
    }

    // Copy .claude/memory.md
    if (!memoryExists) {
      await mkdir(dirname(memoryDest), { recursive: true });
      await copyTemplate(resolve(templateDir, memoryFile), memoryDest, templateVars);
      applied.push(memoryFile);
    }

    // Copy .claude/settings.json
    if (!settingsExists) {
      await mkdir(dirname(settingsDest), { recursive: true });
      await copyTemplate(resolve(templateDir, settingsFile), settingsDest, templateVars);
      applied.push(settingsFile);
    }

    copySpin.stop('Claude Code support installed');

    for (const item of [claudeFile, memoryFile, settingsFile]) {
      if (applied.includes(item)) {
        successMessage(`Created ${item}`);
      }
    }
  } catch (err) {
    copySpin.stop('Failed to install Claude Code support');
    const error = err instanceof Error ? err : new Error('Unknown error');
    errorMessage(error.message);
    return { applied, error };
  }

  // Ensure .gitignore entries
  const gitignoreUpdated = await ensureGitignoreLines(context.targetDir);
  if (gitignoreUpdated) {
    applied.push('.gitignore (.claude entries)');
    successMessage('Added .claude entries to .gitignore');
  }

  return { applied };
}
