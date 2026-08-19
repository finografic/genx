/**
 * Smoke check: workspace detection and member resolution against real repositories on disk.
 *
 * Run: pnpm tsx scripts/smoke-workspace.ts <repo> [...repos]
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { PackageJson } from '../src/types/package-json.types.js';

import {
  isMonorepoRoot,
  readWorkspaceMembers,
  readWorkspacePatterns,
} from '../src/lib/monorepo/monorepo.workspace.js';

const targets = process.argv.slice(2);

for (const target of targets) {
  const dir = resolve(target);
  let packageJson: PackageJson = {};
  try {
    packageJson = JSON.parse(await readFile(resolve(dir, 'package.json'), 'utf8')) as PackageJson;
  } catch {
    console.log(`${target}: no readable package.json`);
    continue;
  }

  const isRoot = await isMonorepoRoot(dir, packageJson);
  const patterns = await readWorkspacePatterns(dir);
  const members = isRoot ? await readWorkspaceMembers(dir) : [];

  console.log(`\n${packageJson.name ?? target}`);
  console.log(`  workspace root : ${isRoot}`);
  console.log(`  patterns       : ${patterns.length > 0 ? patterns.join(', ') : '—'}`);
  for (const member of members) {
    console.log(`  member         : ${member.relativePath}  ${member.name ?? '(unnamed)'}`);
  }
}
