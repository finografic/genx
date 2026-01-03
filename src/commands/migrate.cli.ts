import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import * as clack from '@clack/prompts';
import pc from 'picocolors';

import { copyDir, copyTemplate, ensureDir, errorMessage, infoMessage, intro, successMessage } from 'utils';
import { validateExistingPackage } from 'utils/validation.utils';
import { migrateConfig, type MigrateOnlySection } from 'config/migrate.config';
import type { TemplateVars } from 'types/template.types';

type CliArgs = {
  targetDir: string;
  write: boolean;
  only: Set<MigrateOnlySection> | null;
};

type PackageJson = Record<string, unknown> & {
  name?: string;
  keywords?: unknown;
  scripts?: Record<string, string>;
  'lint-staged'?: Record<string, string[]>;
};

function parseArgs(argv: string[], cwd: string): CliArgs {
  const args = argv.slice();

  // remove command name if present (index.ts passes full argv after selecting command)
  // supports being called directly with `migrate` as argv[0] too
  if (args[0] === 'migrate') args.shift();

  let targetDir = cwd;
  let write = false;
  let only: Set<MigrateOnlySection> | null = null;

  for (const arg of args) {
    if (arg === '--write') {
      write = true;
      continue;
    }
    if (arg.startsWith('--only=')) {
      const raw = arg.slice('--only='.length);
      const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
      only = new Set(parts as MigrateOnlySection[]);
      continue;
    }
    if (!arg.startsWith('-')) {
      targetDir = resolve(cwd, arg);
    }
  }

  return { targetDir, write, only };
}

function isOnlyEnabled(only: Set<MigrateOnlySection> | null, section: MigrateOnlySection): boolean {
  if (!only) return true;
  return only.has(section);
}

function getTemplateDir(): string {
  const thisDir = fileURLToPath(new URL('.', import.meta.url));
  // dist/commands -> templates/package
  return resolve(thisDir, '../../templates/package');
}

async function readPackageJson(path: string): Promise<PackageJson> {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw) as PackageJson;
}

function getScopeAndName(pkgName: string | undefined): { scope: string; name: string } | null {
  if (!pkgName) return null;
  if (pkgName.startsWith('@') && pkgName.includes('/')) {
    const [scope, name] = pkgName.split('/');
    return { scope, name };
  }
  return { scope: migrateConfig.defaultScope, name: pkgName };
}

function ensureKeyword(keywords: string[], kw: string): { keywords: string[]; changed: boolean } {
  if (keywords.some((k) => k.toLowerCase() === kw.toLowerCase())) {
    return { keywords, changed: false };
  }
  return { keywords: [...keywords, kw], changed: true };
}

function patchPackageJson(pkg: PackageJson, packageNameWithoutScope: string): { pkg: PackageJson; changes: string[] } {
  const changes: string[] = [];
  const next: PackageJson = { ...pkg };

  // scripts
  const scripts = { ...(pkg.scripts ?? {}) };
  for (const [key, value] of Object.entries(migrateConfig.packageJson.ensureScripts)) {
    if (scripts[key] !== value) {
      scripts[key] = value;
      changes.push(`scripts.${key}`);
    }
  }
  next.scripts = scripts;

  // lint-staged
  const lintStaged = { ...(pkg['lint-staged'] ?? {}) };
  for (const [pattern, commands] of Object.entries(migrateConfig.packageJson.ensureLintStaged)) {
    const current = lintStaged[pattern];
    if (!Array.isArray(current) || current.join('\n') !== commands.join('\n')) {
      lintStaged[pattern] = commands;
      changes.push(`lint-staged.${pattern}`);
    }
  }
  next['lint-staged'] = lintStaged;

  // keywords
  const kwRaw = pkg.keywords;
  const keywords = Array.isArray(kwRaw) ? (kwRaw.filter((k) => typeof k === 'string') as string[]) : [];
  let changedKeywords = false;

  const finKw = migrateConfig.packageJson.ensureKeywords.includeFinograficKeyword;
  const r1 = ensureKeyword(keywords, finKw);
  changedKeywords = changedKeywords || r1.changed;

  let updated = r1.keywords;
  if (migrateConfig.packageJson.ensureKeywords.includePackageName) {
    const r2 = ensureKeyword(updated, packageNameWithoutScope);
    updated = r2.keywords;
    changedKeywords = changedKeywords || r2.changed;
  }

  if (changedKeywords) {
    next.keywords = updated;
    changes.push('keywords');
  }

  return { pkg: next, changes };
}

async function writePackageJson(path: string, pkg: PackageJson): Promise<void> {
  const formatted = `${JSON.stringify(pkg, null, 2)}\n`;
  await writeFile(path, formatted, 'utf8');
}

export async function migratePackage(argv: string[], options: { cwd: string }): Promise<void> {
  intro('Migrate existing @finografic package');

  const { targetDir, write, only } = parseArgs(argv, options.cwd);

  const validation = validateExistingPackage(targetDir);
  if (!validation.ok) {
    errorMessage(validation.reason || 'Not a valid package directory');
    process.exit(1);
  }

  const packageJsonPath = resolve(targetDir, 'package.json');
  const pkg = await readPackageJson(packageJsonPath);
  const parsed = getScopeAndName(pkg.name);
  if (!parsed) {
    errorMessage('Unable to read package name from package.json');
    process.exit(1);
  }

  // Safety prompt if scope differs from expected
  if (parsed.scope !== migrateConfig.defaultScope) {
    const confirm = await clack.confirm({
      message: `Detected package: ${pc.cyan(`${parsed.scope}/${parsed.name}`)}. Continue?`,
      initialValue: true,
    });
    if (clack.isCancel(confirm) || confirm === false) {
      clack.cancel('Operation cancelled');
      process.exit(0);
    }
  }

  const vars: TemplateVars = {
    SCOPE: parsed.scope,
    NAME: parsed.name,
    PACKAGE_NAME: `${parsed.scope}/${parsed.name}`,
    YEAR: new Date().getFullYear().toString(),
    // These might not exist in every repo; template system leaves unknown tokens as-is.
    DESCRIPTION: typeof pkg.description === 'string' ? pkg.description : '',
    AUTHOR_NAME: '',
    AUTHOR_EMAIL: '',
    AUTHOR_URL: '',
  };

  const plan: string[] = [];

  // package.json patch plan
  if (isOnlyEnabled(only, 'package-json')) {
    const { changes } = patchPackageJson(pkg, parsed.name);
    if (changes.length > 0) {
      plan.push(`patch package.json: ${changes.join(', ')}`);
    } else {
      plan.push('package.json already aligned');
    }
  }

  // template sync plan
  const templateDir = getTemplateDir();
  for (const item of migrateConfig.syncFromTemplate) {
    if (!isOnlyEnabled(only, item.section)) continue;
    plan.push(`sync ${item.targetPath} (from template ${item.templatePath})`);
  }

  // Dry-run default
  if (!write) {
    infoMessage(`\nDry run. Planned changes for: ${pc.cyan(targetDir)}\n`);
    for (const line of plan) {
      clack.log.info(`- ${line}`);
    }
    infoMessage('\nRe-run with `--write` to apply.\n');
    return;
  }

  // Apply package.json patch
  if (isOnlyEnabled(only, 'package-json')) {
    const { pkg: nextPkg, changes } = patchPackageJson(pkg, parsed.name);
    if (changes.length > 0) {
      await writePackageJson(packageJsonPath, nextPkg);
      successMessage(`Updated package.json (${changes.length} changes)`);
    } else {
      infoMessage('package.json already aligned');
    }
  }

  // Apply template sync
  const syncTasks = migrateConfig.syncFromTemplate.filter((item) => isOnlyEnabled(only, item.section));

  if (syncTasks.length > 0) {
    const syncSpin = clack.spinner();
    syncSpin.start(`Syncing ${syncTasks.length} file(s) from template...`);

    for (const item of syncTasks) {
      const src = resolve(templateDir, item.templatePath);
      const dest = resolve(targetDir, item.targetPath);

      // Directory copy
      if (item.templatePath === 'docs') {
        await ensureDir(dest);
        await copyDir(src, dest, vars);
        continue;
      }

      // Ensure destination directory exists
      await ensureDir(dirname(dest));
      await copyTemplate(src, dest, vars);
    }

    syncSpin.stop(`Synced ${syncTasks.length} file(s)`);
  }

  successMessage('Migration complete');
}
