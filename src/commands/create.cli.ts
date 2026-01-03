import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { execa } from 'execa';
import pc from 'picocolors';

import {
  buildTemplateVars,
  copyDir,
  ensureDir,
  errorMessage,
  infoMessage,
  intro,
  outro,
  promptFeatures,
  promptPackageConfig,
  spinner,
  successMessage,
  validateTargetDir,
} from 'utils';
import { safeExit } from 'utils/env.utils';

/**
 * Create a new @finografic package from template.
 */
export async function createPackage(options: { cwd: string }): Promise<void> {
  intro('Create new @finografic package');

  // 1. Prompt for package configuration
  const config = await promptPackageConfig();
  if (!config) {
    safeExit(0);
    return;
  }

  // 2. Prompt for optional features
  const features = await promptFeatures();
  if (!features) {
    safeExit(0);
    return;
  }

  // 3. Determine target directory
  const targetDir = resolve(options.cwd, config.name);

  // 4. Validate target directory
  const validation = await validateTargetDir(targetDir);
  if (!validation.ok) {
    errorMessage(validation.reason || 'Target directory is not valid');
    safeExit(1);
    return;
  }

  // 5. Build context (for future use)
  // const _context: GeneratorContext = {
  //   cwd: options.cwd,
  //   targetDir,
  //   config,
  //   features,
  // };

  // 6. Copy template files
  const spin = spinner();
  spin.start('Creating project structure...');

  try {
    await ensureDir(targetDir);

    // Get template directory (relative to this file)
    // We're in dist/index.mjs, templates are at root
    const thisDir = fileURLToPath(new URL('.', import.meta.url));
    const templateDir = resolve(thisDir, '../../templates/package');

    const vars = buildTemplateVars(config);

    await copyDir(templateDir, targetDir, vars, {
      ignore: features.aiRules ? [] : ['.github/copilot-instructions.md', '.github/instructions'],
    });

    spin.stop('Project structure created');
  } catch (err) {
    spin.stop('Failed to create project structure');
    errorMessage(err instanceof Error ? err.message : 'Unknown error');
    safeExit(1);
    return;
  }

  // 7. Install dependencies
  const installSpin = spinner();
  installSpin.start('Installing dependencies...');

  try {
    await execa('pnpm', ['install'], { cwd: targetDir });
    installSpin.stop('Dependencies installed');
  } catch {
    installSpin.stop('Failed to install dependencies');
    errorMessage('You can run `pnpm install` manually');
  }

  // 8. Initialize git
  const gitSpin = spinner();
  gitSpin.start('Initializing git repository...');

  try {
    await execa('git', ['init'], { cwd: targetDir });
    await execa('git', ['add', '.'], { cwd: targetDir });
    await execa('git', ['commit', '-m', 'chore: initial commit'], { cwd: targetDir });
    gitSpin.stop('Git repository initialized');
  } catch {
    gitSpin.stop('Failed to initialize git');
    errorMessage('You can initialize git manually');
  }

  // 9. Done!
  successMessage('Package created successfully!');

  infoMessage('\nNext steps:');
  console.log(`  ${pc.cyan('cd')} ${config.name}`);
  console.log(`  ${pc.cyan('pnpm')} dev`);

  outro('Happy coding! 🦋');
}
