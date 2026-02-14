import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { execa } from 'execa';
import { FORMATTING_SECTION_TITLE } from 'features/dprint/dprint.constants';
import { getFeature } from 'features/feature-registry';
import { createHelp } from 'help/create.help';

import { generateEslintConfig } from 'lib/generators/eslint-config.generator';
import {
  buildTemplateVars,
  copyDir,
  ensureDir,
  errorMessage,
  findPackageRoot,
  getTemplatesDir,
  infoMessage,
  intro,
  outro,
  spinner,
  validateTargetDir,
} from 'utils';
import { isDevelopment, safeExit } from 'utils/env.utils';
import { pc } from 'utils/picocolors';
import { promptCreatePackage } from 'utils/prompts';
import { renderHelp } from 'utils/render-help/render-help.utils';
import { createConfig } from 'config/create.config';

// NOTE: This command never prompts directly.
// All user input is collected via promptCreatePackage().

/**
 * Create a new @finografic package from template.
 */
export async function createPackage(argv: string[], context: { cwd: string }): Promise<void> {
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

  const selectedFeatures = new Set(config.features);

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
    const templateDir = getTemplatesDir(fromDir);

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
          'If running a linked build, re-run `pnpm build` in @finografic/genx.',
        ].join('\n'),
      );
    }

    const vars = buildTemplateVars(config);

    const ignorePatterns = [
      ...(selectedFeatures.has('aiInstructions') ? [] : createConfig.ignorePatterns.aiInstructions),
      ...(selectedFeatures.has('aiClaude') ? [] : createConfig.ignorePatterns.aiClaude),
    ];

    await copyDir(templateDir, targetDir, vars, {
      ignore: ignorePatterns,
    });

    // Apply package type effects
    const pkgJsonPath = resolve(targetDir, 'package.json');
    const pkgRaw = await readFile(pkgJsonPath, 'utf8');
    const pkgJson = JSON.parse(pkgRaw) as Record<string, unknown>;

    // Merge packageJsonDefaults (e.g. bin for CLI)
    for (const [key, value] of Object.entries(config.packageType.packageJsonDefaults)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Replace __PKG_NAME__ placeholder in nested objects
        const resolved = JSON.parse(
          JSON.stringify(value).replace(/__PKG_NAME__/g, config.name),
        );
        pkgJson[key] = resolved;
      } else {
        pkgJson[key] = value;
      }
    }

    // Merge type-specific scripts (e.g. dev.cli for CLI packages)
    if (config.packageType.scripts) {
      const scripts = (pkgJson['scripts'] ?? {}) as Record<string, string>;
      Object.assign(scripts, config.packageType.scripts);
      pkgJson['scripts'] = scripts;
    }

    // Add package type keywords
    const existingKeywords = (pkgJson['keywords'] as string[]) || [];
    const typeKeywords = [
      `genx:type:${config.packageType.id}`,
      ...config.packageType.keywords,
    ];
    pkgJson['keywords'] = [...existingKeywords, ...typeKeywords];

    // Strip dprint entries when dprint feature is not selected
    if (!selectedFeatures.has('dprint')) {
      const scripts = pkgJson['scripts'] as Record<string, string> | undefined;
      if (scripts) {
        delete scripts['update.dprint-config'];
        delete scripts[FORMATTING_SECTION_TITLE];
        delete scripts['format'];
        delete scripts['format.check'];

        if (scripts['release.check']) {
          scripts['release.check'] = scripts['release.check'].replace('pnpm format.check && ', '');
        }
      }

      const devDeps = pkgJson['devDependencies'] as Record<string, string> | undefined;
      if (devDeps) {
        delete devDeps['@finografic/dprint-config'];
      }

      pkgJson['lint-staged'] = {
        '*.{ts,tsx,js,jsx,mjs,cjs}': ['eslint --fix'],
      };
    }

    // Conditionally add author.url to package.json
    if (config.author.url) {
      const author = pkgJson['author'] as Record<string, string>;
      author['url'] = config.author.url;
    }

    await writeFile(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n', 'utf8');

    // Conditionally strip author URL link from README when URL is blank
    const readmePath = resolve(targetDir, 'README.md');
    if (!config.author.url) {
      const readmeContent = await readFile(readmePath, 'utf8');
      const updated = readmeContent.replace(
        /\[(\*\*[^*]+\*\*)\]\(__AUTHOR_URL__\)/,
        '$1',
      );
      await writeFile(readmePath, updated, 'utf8');
    }

    // Create CLI entry point if type is CLI
    if (config.packageType.entryPoints.includes('src/cli.ts')) {
      const cliEntryPath = resolve(targetDir, 'src/cli.ts');
      await writeFile(
        cliEntryPath,
        `#!/usr/bin/env node\n\nconsole.log('Hello from ${config.name}!');\n`,
        'utf8',
      );
    }

    // Generate eslint.config.ts based on package type + selected features
    const eslintContent = generateEslintConfig({
      globals: config.packageType.eslint.globals,
      markdown: selectedFeatures.has('markdown'),
    });
    await writeFile(resolve(targetDir, 'eslint.config.ts'), eslintContent, 'utf8');

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

  // 6. Apply selected features (after install so node_modules exist)
  for (const featureId of config.features) {
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
    await execa('git', ['commit', '-m', 'chore: initial commit'], {
      cwd: targetDir,
    });
    gitSpin.stop('Git repository initialized');
  } catch {
    gitSpin.stop('Failed to initialize git');
    errorMessage('You can initialize git manually');
  }

  // 8. Done!
  outro('Package created successfully!');

  console.log(pc.dim('Next steps:'));
  console.log(`cd ${config.name}`);
  console.log('pnpm dev');

  console.log(`\n${pc.cyan('🦋 Happy coding!')}\n`);
}
