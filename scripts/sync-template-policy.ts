/**
 * Align `_templates/` with deps-policy.
 *
 * `_templates/package.json` and `_templates/.nvmrc` restate versions that deps-policy already owns,
 * and nothing forced them to stay current — they had drifted as far as `typescript@^5.9.3` against
 * a policy of `7.0.2`, and `pnpm@10.32.1` against `11.21.0`.
 *
 * That is not cosmetic. Two upgrade paths copy the template outward:
 *
 * - `upgrade --nvmrc` syncs `_templates/.nvmrc` verbatim into managed repos, so a stale file actively
 *   downgrades them.
 * - `upgrade --merges` merges `_templates/package.json` into the target.
 *
 * `--check` writes nothing and exits non-zero on drift; that mode runs in `release:check` and CI,
 * for the same reason `check:cli-core-spec` does — a writer alone drifts again the moment someone
 * forgets to run it.
 *
 * Only fields policy owns are touched. Scripts, lint-staged globs and file structure are
 * hand-authored and left alone.
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import type { PackageJson } from '../src/types/package-json.types';

import { policy, toolchain } from '../src/config/policy';

const ROOT = path.resolve(import.meta.dirname, '..');
const TEMPLATE_PACKAGE_JSON = path.join(ROOT, '_templates/package.json');
const TEMPLATE_NVMRC = path.join(ROOT, '_templates/.nvmrc');

interface Drift {
  file: string;
  field: string;
  from: string;
  to: string;
}

/** `engines.node` / `packageManager` / `.nvmrc` exactly as `create` writes them. */
const expectedEnginesNode = `>=${toolchain.node}`;
const expectedPackageManager = `pnpm@${toolchain.pnpm}`;
const expectedNvmrc = `${toolchain.node}\n`;

function alignDependencySection(
  packageJson: PackageJson,
  section: 'dependencies' | 'devDependencies',
  drift: Drift[],
): void {
  const declared = packageJson[section];
  if (!declared) return;

  // The template is the shared baseline; per-type extras are applied by `create` at generation
  // time, so `base` is the right group to align against here.
  const policyVersions = { ...policy.base[section] };

  for (const [name, current] of Object.entries(declared)) {
    const target = policyVersions[name];
    if (target === undefined || target === current) continue;

    declared[name] = target;
    drift.push({ file: 'package.json', field: `${section}.${name}`, from: current, to: target });
  }
}

async function collectDrift(): Promise<{ drift: Drift[]; packageJson: PackageJson; nvmrc: string }> {
  const raw = await readFile(TEMPLATE_PACKAGE_JSON, 'utf8');
  const packageJson = JSON.parse(raw) as PackageJson;
  const nvmrc = await readFile(TEMPLATE_NVMRC, 'utf8');

  const drift: Drift[] = [];

  alignDependencySection(packageJson, 'dependencies', drift);
  alignDependencySection(packageJson, 'devDependencies', drift);

  const engines = (packageJson['engines'] ?? {}) as Record<string, string>;
  if (engines['node'] !== expectedEnginesNode) {
    drift.push({
      file: 'package.json',
      field: 'engines.node',
      from: engines['node'] ?? '(absent)',
      to: expectedEnginesNode,
    });
    engines['node'] = expectedEnginesNode;
    packageJson['engines'] = engines;
  }

  const { packageManager } = packageJson;
  if (packageManager !== expectedPackageManager) {
    drift.push({
      file: 'package.json',
      field: 'packageManager',
      from: typeof packageManager === 'string' ? packageManager : '(absent)',
      to: expectedPackageManager,
    });
    packageJson['packageManager'] = expectedPackageManager;
  }

  if (nvmrc !== expectedNvmrc) {
    drift.push({
      file: '.nvmrc',
      field: 'node',
      from: nvmrc.trim(),
      to: expectedNvmrc.trim(),
    });
  }

  return { drift, packageJson, nvmrc };
}

async function main(): Promise<void> {
  const checkOnly = process.argv.includes('--check');
  const { drift, packageJson } = await collectDrift();

  if (drift.length === 0) {
    console.log('_templates/ is aligned with deps-policy.');
    return;
  }

  const width = Math.max(...drift.map((entry) => `${entry.file} ${entry.field}`.length));
  for (const entry of drift) {
    console.log(`  ${`${entry.file} ${entry.field}`.padEnd(width)}  ${entry.from} → ${entry.to}`);
  }

  if (checkOnly) {
    console.error(
      `\n${drift.length} field(s) in _templates/ have drifted from deps-policy.\n` +
        'Run `pnpm sync:templates` to align them.',
    );
    process.exit(1);
  }

  await writeFile(TEMPLATE_PACKAGE_JSON, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  await writeFile(TEMPLATE_NVMRC, expectedNvmrc, 'utf8');
  console.log(`\nAligned ${drift.length} field(s) in _templates/.`);
}

await main();
