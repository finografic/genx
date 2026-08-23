import { existsSync } from 'node:fs';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFlowContext } from '@finografic/cli-kit/flow';
import { withHelp } from '@finografic/cli-kit/render-help';
import { execa } from 'execa';
import { getFeature } from 'features/feature-registry';
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
  runPnpmInstall,
  spinner,
  validateTargetDir,
} from 'utils';

import { generateCliHelpContent } from 'lib/generators/cli-help.generator';
import { alignScaffoldDependencies } from 'lib/package-policy/scaffold-policy.utils';
import { installSharedSkills } from 'lib/skills/skills-install.runner';
import { isDevelopment } from 'utils/env.utils';
import { pc } from 'utils/picocolors';
import { promptCreatePackage } from 'utils/prompts';

import { createConfig } from 'config/create.config';
import { policy, resolvePolicy, toPolicyPackageType, toolchain } from 'config/policy.js';

import { createMonorepo } from './create-monorepo.cli.js';
import { help } from './create.help.js';

// NOTE: This command never prompts directly.
// All user input is collected via promptCreatePackage().

/**
 * Create a new @finografic package from template.
 */
export async function createPackage(argv: string[], context: { cwd: string }): Promise<void> {
  // `create monorepo` scaffolds a workspace from the pinned monorepo-starter tag, not from
  // _templates/. Dispatch before the package flow claims the args.
  if (argv[0] === 'monorepo') {
    return createMonorepo(argv.slice(1), context);
  }

  return withHelp(argv, help, async () => {
    intro('Create new @finografic package');

    // Helpful debug info (always on in dev)
    const debug = isDevelopment() || process.env.FINOGRAFIC_DEBUG === '1';
    if (debug) {
      infoMessage(`execPath: ${process.execPath}`);
      infoMessage(`argv[1]: ${process.argv[1] ?? ''}`);
    }

    const flow = createFlowContext(argv, {
      y: { type: 'boolean' },
      type: { type: 'string' },
      name: { type: 'string' },
    });

    // 1. Prompt for ALL creation input (manifest + author + features)
    const config = await promptCreatePackage(flow);

    const selectedFeatures = new Set(config.features);

    // 2. Determine target directory
    const targetDir = resolve(context.cwd, config.name);

    // 3. Validate target directory
    const validation = await validateTargetDir(targetDir);
    if (!validation.ok) {
      errorMessage(validation.reason || 'Target directory is not valid');
      process.exit(1);
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

      const isCli = config.packageType.entryPoints.includes('src/cli.ts');
      const ignorePatterns = [
        'feature',
        'package-types',
        ...(selectedFeatures.has('aiInstructions') ? [] : createConfig.ignorePatterns.aiInstructions),
        ...(selectedFeatures.has('aiMemory') ? [] : createConfig.ignorePatterns.aiMemory),
        ...(!isCli ? ['docs/spec'] : []),
      ];

      await copyDir(templateDir, targetDir, vars, {
        ignore: ignorePatterns,
      });

      // Copy package-type template overlay (e.g. _templates/package-types/react/)
      if (config.packageType.templateOverlayDir) {
        const overlayDir = resolve(templateDir, config.packageType.templateOverlayDir);
        if (existsSync(overlayDir)) {
          await copyDir(overlayDir, targetDir, vars, {
            ignore: ignorePatterns,
            templateExtensions: [
              '.json',
              '.ts',
              '.tsx',
              '.md',
              '.yml',
              '.yaml',
              '.mjs',
              '.js',
              '.html',
              '.css',
            ],
          });
        }
      }

      // Apply package type effects
      const pkgJsonPath = resolve(targetDir, 'package.json');
      const pkgRaw = await readFile(pkgJsonPath, 'utf8');
      const pkgJson = JSON.parse(pkgRaw) as Record<string, unknown>;

      // Merge packageJsonDefaults (e.g. bin for CLI)
      for (const [key, value] of Object.entries(config.packageType.packageJsonDefaults)) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Replace __PKG_NAME__ placeholder in nested objects
          const resolved = JSON.parse(JSON.stringify(value).replace(/__PKG_NAME__/g, config.name));
          pkgJson[key] = resolved;
        } else {
          pkgJson[key] = value;
        }
      }

      // Merge type-specific scripts (e.g. dev:cli for CLI packages)
      if (config.packageType.scripts) {
        const scripts = (pkgJson['scripts'] ?? {}) as Record<string, string>;
        Object.assign(scripts, config.packageType.scripts);
        pkgJson['scripts'] = scripts;
      }

      // Add package type keywords
      const existingKeywords = (pkgJson['keywords'] as string[]) || [];
      const typeKeywords = [`genx:type:${config.packageType.id}`, ...config.packageType.keywords];
      pkgJson['keywords'] = [...existingKeywords, ...typeKeywords];

      // Conditionally add author.url to package.json
      if (config.author.url) {
        const author = pkgJson['author'] as Record<string, string>;
        author['url'] = config.author.url;
      }

      // Toolchain versions from deps-policy
      const engines = (pkgJson['engines'] ?? {}) as Record<string, string>;
      engines['node'] = `>=${toolchain.node}`;
      pkgJson['engines'] = engines;
      pkgJson['packageManager'] = `pnpm@${toolchain.pnpm}`;

      await writeFile(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n', 'utf8');

      // Write .nvmrc with policy-driven node version (overwrite template copy)
      await writeFile(resolve(targetDir, '.nvmrc'), `${toolchain.node}\n`, 'utf8');

      // Conditionally strip author URL link from README when URL is blank.
      // applyTemplate has already replaced __AUTHOR_URL__ with '', leaving [Name]() — strip the empty link.
      const readmePath = resolve(targetDir, 'README.md');
      if (!config.author.url) {
        const readmeContent = await readFile(readmePath, 'utf8');
        const updated = readmeContent.replace(/\[([^\]]+)\]\(\)/g, '$1');
        await writeFile(readmePath, updated, 'utf8');
      }

      // React app: strip library-oriented fields and add React dependencies
      const isReact = config.packageType.id === 'react';
      if (isReact) {
        for (const key of ['main', 'types', 'module', 'files', 'exports']) {
          delete pkgJson[key];
        }

        // Remove library-only devDeps (tsdown is replaced by Vite)
        const devDeps = (pkgJson['devDependencies'] ?? {}) as Record<string, string>;
        delete devDeps['tsdown'];

        // Remove tsdown-oriented scripts; React scripts are merged via packageType.scripts
        const scripts = (pkgJson['scripts'] ?? {}) as Record<string, string>;
        delete scripts['link'];
        delete scripts['unlink'];
        delete scripts['prepack'];

        // Replace library dev/build scripts with React equivalents (already merged via scripts)
        // The base template's `dev: tsdown --watch` and `build: tsdown` are overwritten above

        // Runtime deps
        const deps = (pkgJson['dependencies'] ?? {}) as Record<string, string>;
        deps['react'] = '^19.2.0';
        deps['react-dom'] = '^19.2.0';
        deps['@finografic/design-system'] = '^1.18.2';
        deps['@finografic/icons'] = '^1.18.2';
        pkgJson['dependencies'] = deps;

        // Dev deps
        devDeps['@pandacss/dev'] = '^1.11.1';
        devDeps['@types/react'] = '^19.2.2';
        devDeps['@types/react-dom'] = '^19.2.2';
        devDeps['@vitejs/plugin-react'] = '^5.1.0';
        devDeps['concurrently'] = '^9.2.1';
        devDeps['vite'] = '^7.1.10';

        // Update prepare script for Panda codegen
        scripts['prepare'] = 'husky && pnpm panda:codegen';

        await writeFile(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n', 'utf8');

        // Remove the library entry point (src/index.ts) — React uses src/main.tsx
        const indexPath = resolve(targetDir, 'src/index.ts');
        if (existsSync(indexPath)) {
          await unlink(indexPath);
        }

        // Remove tsdown.config.ts — React uses vite.config.ts
        const tsdownConfigPath = resolve(targetDir, 'tsdown.config.ts');
        if (existsSync(tsdownConfigPath)) {
          await unlink(tsdownConfigPath);
        }
      }

      // Create CLI entry point and help file if type is CLI
      if (config.packageType.entryPoints.includes('src/cli.ts')) {
        const cliEntryPath = resolve(targetDir, 'src/cli.ts');
        await writeFile(
          cliEntryPath,
          `#!/usr/bin/env node\n\nconsole.log('Hello from ${config.name}!');\n`,
          'utf8',
        );

        // Generate *.help.ts (standard @finografic CLI help format)
        const helpPath = resolve(targetDir, `src/${config.name}.help.ts`);
        await writeFile(helpPath, generateCliHelpContent(config.name), 'utf8');

        // Ensure picocolors is in dependencies (required by the help file)
        const deps = (pkgJson['dependencies'] ?? {}) as Record<string, string>;
        if (!deps['picocolors']) {
          deps['picocolors'] = policy.cli.dependencies?.['picocolors'] ?? '^1.1.1';
          pkgJson['dependencies'] = deps;
          await writeFile(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n', 'utf8');
        }
      }

      // Align every declared dependency to policy, last, so it also covers the versions the react
      // and CLI branches just wrote. The template decides which dependencies a new package gets;
      // policy decides their versions — so `_templates/package.json` no longer needs to carry a
      // second copy of every version number, which is the copy that goes stale unnoticed.
      const { packageJson: alignedPkgJson, aligned } = alignScaffoldDependencies(
        pkgJson,
        resolvePolicy(toPolicyPackageType(config.packageType.id)),
      );
      if (aligned.length > 0) {
        await writeFile(pkgJsonPath, JSON.stringify(alignedPkgJson, null, 2) + '\n', 'utf8');
      }

      spin.stop('Project structure created');

      if (aligned.length > 0) {
        const label = aligned.length === 1 ? '1 dependency' : `${aligned.length} dependencies`;
        infoMessage(pc.gray(`Aligned ${label} to deps-policy`));
      }
    } catch (err) {
      spin.stop('Failed to create project structure');
      errorMessage(err instanceof Error ? err.message : 'Unknown error');
      process.exit(1);
      return;
    }

    // 5. Install dependencies
    const installSpin = spinner();
    installSpin.start('Installing dependencies...');

    try {
      await runPnpmInstall(targetDir);
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

    // 6b. Shared skills, before `git init` so they land in Genesis. Nothing is tracked yet, so the
    // symlinks cause no type change and need no commit split. Not offered: a new project has
    // nothing to overwrite, and skills are baseline here the way `oxc-config` is.
    await installSharedSkills({ targetDir, commit: false });

    // 7. Initialize git
    const gitSpin = spinner();
    gitSpin.start('Initializing git repository...');

    try {
      await execa('git', ['init'], { cwd: targetDir });
      await execa('git', ['add', '.'], { cwd: targetDir });
      await execa('git', ['commit', '-m', '🌱 Genesis'], {
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
  });
}
