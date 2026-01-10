import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { execa } from 'execa';
import { createHelp } from 'help/create.help';
import pc from 'picocolors';

import {
  buildTemplateVars,
  copyDir,
  ensureDir,
  errorMessage,
  findPackageRoot,
  getTemplatesPackageDir,
  infoMessage,
  intro,
  outro,
  spinner,
  validateTargetDir,
} from 'utils';
import { isDevelopment, safeExit } from 'utils/env.utils';
import { promptCreatePackage } from 'utils/prompts';
import { renderHelp } from 'utils/render-help/render-help.utils';
import { createConfig } from 'config/create.config';

// NOTE: This command never prompts directly.
// All user input is collected via promptCreatePackage().

/**
 * Create a new @finografic package from template.
 */
export async function createPackage( argv: string[],
  context: { cwd: string }): Promise<void> {

  if (argv.includes('--help') || argv.includes('-h')) {
    renderHelp(createHelp);
    return;
  }

  intro('Create new @finografic package');

  // Helpful debug info (always on in dev)
  const debug = isDevelopment() || process.env.FINOGRAFIC_DEBUG === '1';
  if (debug) {
    infoMessage(`execPath: ${process.execPath}`);
    infoMessage(`argv[1]: ${process.argv[1] ?? ''}`);
  }

  // 1. Prompt for ALL creation input (manifest + author + features)
  const config = await promptCreatePackage();
  if (!config) {
    safeExit(0);
    return;
  }

  const { features } = config;

  // 2. Determine target directory
  const targetDir = resolve(context.cwd, config.name);

  // 3. Validate target directory
  const validation = await validateTargetDir(targetDir);
  if (!validation.ok) {
    errorMessage(validation.reason || 'Target directory is not valid');
    safeExit(1);
    return;
  }

  // 4. Copy template files
  const spin = spinner();
  spin.start('Creating project structure...');

  try {
    await ensureDir(targetDir);

    // Resolve templates from package root
    const fromDir = fileURLToPath(new URL('.', import.meta.url));
    const packageRoot = findPackageRoot(fromDir);
    const templateDir = getTemplatesPackageDir(fromDir);

    if (debug) {
      infoMessage(`importMetaDir: ${fromDir}`);
      infoMessage(`packageRoot: ${packageRoot}`);
      infoMessage(`templateDir: ${templateDir}`);
    }

    if (!existsSync(templateDir)) {
      throw new Error(
        [
          'Template directory not found.',
          `templateDir: ${templateDir}`,
          `importMetaDir: ${fromDir}`,
          `packageRoot: ${packageRoot}`,
          'If running a linked build, re-run `pnpm build` in @finografic/create.',
        ].join('\n'),
      );
    }

    const vars = buildTemplateVars(config);

    await copyDir(templateDir, targetDir, vars, {
      ignore: features.aiRules
        ? []
        : createConfig.ignorePatterns.aiRules,
    });

    spin.stop('Project structure created');
  } catch (err) {
    spin.stop('Failed to create project structure');
    errorMessage(err instanceof Error ? err.message : 'Unknown error');
    safeExit(1);
    return;
  }

  // 5. Install dependencies
  const installSpin = spinner();
  installSpin.start('Installing dependencies...');

  try {
    await execa('pnpm', ['install'], { cwd: targetDir });
    installSpin.stop('Dependencies installed');
  } catch {
    installSpin.stop('Failed to install dependencies');
    errorMessage('You can run `pnpm install` manually');
  }

  // 6. Initialize git
  const gitSpin = spinner();
  gitSpin.start('Initializing git repository...');

  try {
    await execa('git', ['init'], { cwd: targetDir });
    await execa('git', ['add', '.'], { cwd: targetDir });
    await execa('git', ['commit', '-m', 'chore: initial commit'], {
      cwd: targetDir,
    });
    gitSpin.stop('Git repository initialized');
  } catch {
    gitSpin.stop('Failed to initialize git');
    errorMessage('You can initialize git manually');
  }

  // 7. Done!
  outro('Package created successfully!');

  console.log(pc.dim('Next steps:'));
  console.log(`cd ${config.name}`);
  console.log('pnpm dev');

  console.log(`\n${pc.cyan('🦋 Happy coding!')}\n`);
}
