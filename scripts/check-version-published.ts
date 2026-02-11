import fs from 'node:fs';
import path from 'node:path';

import { execa } from 'execa';

const ROOT = path.resolve(import.meta.dirname, '..');
const PACKAGE_JSON = path.join(ROOT, 'package.json');

interface PackageJson {
  name: string;
  version: string;
  publishConfig?: {
    registry?: string;
  };
}

const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8')) as PackageJson;
const { name, version, publishConfig } = packageJson;

const registry = publishConfig?.registry ?? 'https://registry.npmjs.org';

async function checkVersionPublished(): Promise<boolean> {
  try {
    // Try to view the specific version
    await execa('pnpm', ['view', name, 'versions', '--json', `--registry=${registry}`], {
      cwd: ROOT,
    });
    // If we can view versions, check if current version exists
    const { stdout } = await execa(
      'pnpm',
      ['view', `${name}@${version}`, 'version', `--registry=${registry}`],
      {
        cwd: ROOT,
      },
    );
    const publishedVersion = stdout.trim();
    return publishedVersion === version;
  } catch (error) {
    // If the command fails, the version likely doesn't exist
    // Check if it's a 404 or similar
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('404') || errorMessage.includes('not found')) {
      return false;
    }
    // For other errors, assume version doesn't exist to be safe
    return false;
  }
}

async function main() {
  const isPublished = await checkVersionPublished();

  if (isPublished) {
    console.error(`❌ Version ${version} of ${name} is already published to ${registry}`);
    console.error('');
    console.error('To publish a new version, use one of these commands:');
    console.error('  pnpm release.github.patch  # Bumps to 2.2.1');
    console.error('  pnpm release.github.minor # Bumps to 2.3.0');
    console.error('  pnpm release.github.major # Bumps to 3.0.0');
    console.error('');
    console.error('These commands will:');
    console.error('  1. Run checks (lint, typecheck, test)');
    console.error('  2. Bump the version');
    console.error('  3. Push to GitHub');
    console.error('  4. GitHub Actions will automatically publish');
    process.exit(1);
  }

  console.log(`✅ Version ${version} is not published yet`);
}

main().catch((error) => {
  console.error('Error checking version:', error);
  process.exit(1);
});
