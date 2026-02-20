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
 * Read name and description from the target project's package.json.
 * Returns empty strings if the file is missing or unparseable.
 */
async function readPackageVars(
  targetDir: string,
): Promise<{ PACKAGE_NAME: string; DESCRIPTION: string }> {
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
 * Installs CLAUDE.md, .claude/memory.md, .claude/handoff.md, .claude/settings.json,
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

  const [claudeFile, memoryFile, settingsFile, handoffFile] = AI_CLAUDE_FILES;

  const claudeDest = resolve(context.targetDir, claudeFile);
  const memoryDest = resolve(context.targetDir, memoryFile);
  const settingsDest = resolve(context.targetDir, settingsFile);
  const handoffDest = resolve(context.targetDir, handoffFile);

  const claudeExists = fileExists(claudeDest);
  const memoryExists = fileExists(memoryDest);
  const settingsExists = fileExists(settingsDest);
  const handoffExists = fileExists(handoffDest);

  const assetsDir = resolve(context.targetDir, '.claude/assets');
  const assetsExists = existsSync(assetsDir);

  if (claudeExists && memoryExists && settingsExists && handoffExists && assetsExists) {
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

  const baseVars = {
    SCOPE: '',
    NAME: '',
    PACKAGE_NAME: '',
    YEAR: new Date().getFullYear().toString(),
    DESCRIPTION: '',
    AUTHOR_NAME: '',
    AUTHOR_EMAIL: '',
  };

  // Read real package name/description for the handoff template
  const pkgVars = await readPackageVars(context.targetDir);
  const handoffVars = { ...baseVars, ...pkgVars };

  const copySpin = spinner();
  copySpin.start('Installing Claude Code support...');

  try {
    // Copy CLAUDE.md
    if (!claudeExists) {
      await copyTemplate(resolve(templateDir, claudeFile), claudeDest, baseVars);
      applied.push(claudeFile);
    }

    // Copy .claude/memory.md
    if (!memoryExists) {
      await mkdir(dirname(memoryDest), { recursive: true });
      await copyTemplate(resolve(templateDir, memoryFile), memoryDest, baseVars);
      applied.push(memoryFile);
    }

    // Copy .claude/settings.json
    if (!settingsExists) {
      await mkdir(dirname(settingsDest), { recursive: true });
      await copyTemplate(resolve(templateDir, settingsFile), settingsDest, baseVars);
      applied.push(settingsFile);
    }

    // Copy .claude/handoff.md
    if (!handoffExists) {
      await mkdir(dirname(handoffDest), { recursive: true });
      await copyTemplate(resolve(templateDir, handoffFile), handoffDest, handoffVars);
      applied.push(handoffFile);
    }

    // Ensure .claude/assets/ directory exists (working area for Claude sessions)
    const assetsDest = resolve(context.targetDir, '.claude/assets');
    if (!existsSync(assetsDest)) {
      await mkdir(assetsDest, { recursive: true });
      applied.push('.claude/assets/');
    }

    copySpin.stop('Claude Code support installed');

    for (const item of [claudeFile, memoryFile, settingsFile, handoffFile]) {
      if (applied.includes(item)) {
        successMessage(`Created ${item}`);
      }
    }
    if (applied.includes('.claude/assets/')) {
      successMessage('Created .claude/assets/');
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
