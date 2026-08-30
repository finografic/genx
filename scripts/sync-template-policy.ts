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
 * for the same reason `templates:cli-core:check` does — a writer alone drifts again the moment someone
 * forgets to run it.
 *
 * Only fields policy owns are touched. Scripts, lint-staged globs and file structure are
 * hand-authored and left alone.
 */

import { execFile as execFileCallback } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import { promisify } from 'node:util';
import type { PackageJson } from '../src/types/package-json.types';

import { policy, toolchain } from '../src/config/policy';
import { pc } from '../src/utils/picocolors';

const execFile = promisify(execFileCallback);

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

function fieldCount(count: number): string {
  return `${count} field${count === 1 ? '' : 's'}`;
}

async function writeTemplates(packageJson: PackageJson, nvmrc: string): Promise<void> {
  await writeFile(TEMPLATE_PACKAGE_JSON, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  await writeFile(TEMPLATE_NVMRC, nvmrc, 'utf8');
}

const SYNC_COMMIT_MESSAGE = 'deps(templates): sync _templates with deps-policy';

/**
 * Commit just the two template files.
 *
 * `--only` with explicit paths so nothing else in the working tree is swept in — a release run
 * routinely has unrelated edits open, and they are not part of this fix.
 *
 * Committing is what lets the run carry on: `pnpm version` tags whatever is committed, so an
 * uncommitted fix would ship a tag that does not contain it. Returns false when git refuses
 * (no repo, or a hook rejects the message), leaving the caller to fail the check as before.
 */
async function commitTemplates(): Promise<boolean> {
  const paths = [TEMPLATE_PACKAGE_JSON, TEMPLATE_NVMRC];

  try {
    await execFile('git', ['add', '--', ...paths], { cwd: ROOT });
    await execFile('git', ['commit', '-m', SYNC_COMMIT_MESSAGE, '--only', '--', ...paths], { cwd: ROOT });
    return true;
  } catch {
    await execFile('git', ['restore', '--staged', '--', ...paths], { cwd: ROOT }).catch(() => undefined);
    return false;
  }
}

/**
 * Ask whether to align the templates right now.
 *
 * Only when stdin is a TTY: `--check` runs in CI and in `release:check`, where there is nobody to
 * answer and a blocked read would hang the pipeline. Without a terminal this returns false and the
 * check fails exactly as it did before.
 */
async function confirmSync(): Promise<boolean> {
  if (!process.stdin.isTTY) return false;

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(pc.white('Update template deps now? [Y/n] '))).trim().toLowerCase();
    return answer === '' || answer === 'y' || answer === 'yes';
  } catch {
    // Ctrl-D, or stdin closing under us. Declining is the safe reading of "no answer": the check
    // still fails and nothing is written, which is what happens without a terminal at all.
    return false;
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const checkOnly = process.argv.includes('--check');
  const { drift, packageJson } = await collectDrift();

  if (drift.length === 0) {
    console.log(`${pc.green('✔')} ${pc.green('_templates/ is aligned with deps-policy.')}`);
    return;
  }

  // Drift is a finding in --check and a work item in sync, so the rows stay neutral and the
  // verdict below carries the colour: stale value in red, the policy value replacing it in green.
  console.log(pc.yellow(`\n${fieldCount(drift.length)} out of sync with deps-policy:\n`));

  const width = Math.max(...drift.map((entry) => `${entry.file} ${entry.field}`.length));
  for (const entry of drift) {
    const label = `${entry.file} ${entry.field}`.padEnd(width);
    console.log(`  ${pc.white(label)}  ${pc.red(entry.from)} ${pc.gray('→')} ${pc.green(entry.to)}`);
  }

  if (checkOnly) {
    // The verdict stays red because it fails the build, but the fix is the part worth reading and
    // it lands directly above pnpm's ELIFECYCLE lines. Giving it its own blank lines and a warning
    // colour keeps it findable instead of grey text swallowed by the noise below.
    console.error(
      `\n${pc.red('✘')} ${pc.red(`${fieldCount(drift.length)} in _templates/ have drifted from deps-policy.`)}\n`,
    );
    // One colour for the whole line so it reads as a single hint; the command is the only part
    // worth acting on, so it stays bright while the prose around it recedes.
    console.error(
      `${pc.yellow('⚠️')}  ${pc.yellow(pc.dim('Run'))} ${pc.bold(pc.yellow('pnpm templates:policy:sync'))} ${pc.yellow(pc.dim('to align them.'))}\n`,
    );

    if (await confirmSync()) {
      await writeTemplates(packageJson, expectedNvmrc);
      console.log(`\n${pc.green('✔')} ${pc.green(`Aligned ${fieldCount(drift.length)} in _templates/.`)}`);

      // Commit it, then let the run continue. Stopping here to ask for a commit would defeat the
      // prompt: the whole point is not to lose the release to a drift the script can fix itself.
      if (await commitTemplates()) {
        console.log(`${pc.green('✔')} ${pc.green(`Committed: ${SYNC_COMMIT_MESSAGE}`)}\n`);
        return;
      }

      console.error(
        `${pc.yellow('⚠️  Templates were written but could not be committed.')}\n` +
          `${pc.yellow('   Commit them, then run the release again.')}\n`,
      );
    }

    process.exit(1);
  }

  await writeTemplates(packageJson, expectedNvmrc);
  console.log(`\n${pc.green('✔')} ${pc.green(`Aligned ${fieldCount(drift.length)} in _templates/.`)}`);
}

await main();
