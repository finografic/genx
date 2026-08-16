import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFlowContext } from '@finografic/cli-kit/flow';
import { withHelp } from '@finografic/cli-kit/render-help';
import { execa } from 'execa';
import { getFeature } from 'features/feature-registry';
import {
  errorMessage,
  GENX_CONFIG_PATH,
  getTemplatesDir,
  infoMessage,
  intro,
  outro,
  runPnpmInstall,
  spinner,
  validateTargetDir,
} from 'utils';

import { applyMonorepoIdentity, cloneStarter } from 'lib/monorepo';
import { pc } from 'utils/picocolors';
import { promptCreateMonorepo } from 'utils/prompts';

import { monorepoConfig } from 'config/monorepo.config';
import { toolchain } from 'config/policy.js';

import { help } from './create-monorepo.help.js';

/**
 * Create a new monorepo from the pinned `monorepo-starter` tag.
 *
 * V0: clone, rewrite root identity, align toolchain, apply root-scoped features. No feature
 * options and no app-code subtraction — see `docs/todo/TODO_MONOREPO_GENERATOR.md`.
 */
export async function createMonorepo(argv: string[], context: { cwd: string }): Promise<void> {
  return withHelp(argv, help, async () => {
    intro('Create new @finografic monorepo');

    const flow = createFlowContext(argv, {
      'y': { type: 'boolean' },
      'name': { type: 'string' },
      'no-install': { type: 'boolean' },
    });

    const skipInstall = argv.includes('--no-install');

    // 1. Prompt for identity (no package type, no feature picker)
    const config = await promptCreateMonorepo(flow);
    const scope = config.scope.startsWith('@') ? config.scope : `@${config.scope}`;
    const packageName = `${scope}/${config.name}`;

    // 2. Validate target directory
    const targetDir = resolve(context.cwd, config.name);
    const validation = await validateTargetDir(targetDir);
    if (!validation.ok) {
      errorMessage(validation.reason || 'Target directory is not valid');
      process.exit(1);
      return;
    }

    // 3. Clone the starter at the pinned tag
    const cloneSpin = spinner();
    cloneSpin.start(`Cloning monorepo-starter at ${monorepoConfig.pinnedTag}...`);

    try {
      await cloneStarter({
        repoUrl: monorepoConfig.repoUrl,
        tag: monorepoConfig.pinnedTag,
        targetDir,
      });
      cloneSpin.stop(`Cloned monorepo-starter at ${monorepoConfig.pinnedTag}`);
    } catch (error) {
      cloneSpin.stop('Failed to clone monorepo-starter');
      errorMessage(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
      return;
    }

    // 4. Rewrite root identity + apply policy toolchain
    const identitySpin = spinner();
    identitySpin.start('Applying workspace identity...');

    try {
      const fromDir = fileURLToPath(new URL('.', import.meta.url));
      const templateDir = getTemplatesDir(fromDir);
      if (!existsSync(templateDir)) {
        throw new Error(
          `Template directory not found: ${templateDir}\nIf running a linked build, re-run \`pnpm build\` in @finografic/genx.`,
        );
      }

      await applyMonorepoIdentity({
        targetDir,
        templateDir,
        identity: {
          scope,
          name: config.name,
          description: config.description,
          author: config.author,
        },
        toolchain,
        docsTodoResetPrefixes: monorepoConfig.docsTodoResetPrefixes,
      });
      identitySpin.stop('Workspace identity applied');
    } catch (error) {
      identitySpin.stop('Failed to apply workspace identity');
      errorMessage(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
      return;
    }

    // 5. Install dependencies (before features, so node_modules exist)
    if (skipInstall) {
      infoMessage('Skipped pnpm install (--no-install)');
    } else {
      const installSpin = spinner();
      installSpin.start('Installing dependencies...');
      try {
        await runPnpmInstall(targetDir);
        installSpin.stop('Dependencies installed');
      } catch {
        installSpin.stop('Failed to install dependencies');
        errorMessage('You can run `pnpm install` manually');
      }
    }

    // 6. Apply root-scoped features only.
    // Package-scoped features (vitest, css, reactVite) assume a single-package src/ layout.
    for (const featureId of monorepoConfig.rootFeatures) {
      const feature = getFeature(featureId);
      if (!feature) continue;
      await feature.apply({ targetDir });
    }

    // 7. Initialize git
    const gitSpin = spinner();
    gitSpin.start('Initializing git repository...');

    try {
      await execa('git', ['init'], { cwd: targetDir });
      await execa('git', ['add', '.'], { cwd: targetDir });
      await execa('git', ['commit', '-m', '🌱 Genesis'], { cwd: targetDir });
      gitSpin.stop('Git repository initialized');
    } catch {
      gitSpin.stop('Failed to initialize git');
      errorMessage('You can initialize git manually');
    }

    // 8. Done — print the managed-config block rather than writing it.
    // genx.config.jsonc carries hand-maintained comment dividers; preserving them on write is a
    // separate task (see docs/todo/TODO_MONOREPO_GENERATOR.md).
    outro('Monorepo created successfully!');

    console.log(pc.dim(`To keep it aligned by genx, add to ${GENX_CONFIG_PATH}:`));
    console.log(
      `${pc.dim('{')}\n  ${pc.dim('"name":')} "${packageName}",\n  ${pc.dim('"path":')} "${targetDir}",\n${pc.dim('},')}`,
    );

    console.log(`\n${pc.dim('Next steps:')}`);
    console.log(`cd ${config.name}`);
    if (skipInstall) {
      console.log('pnpm install');
    }
    console.log('cp .env.example .env');
    console.log('pnpm db:setup');
    console.log('pnpm dev');

    console.log(`\n${pc.cyan('🦋 Happy coding!')}\n`);
  });
}
