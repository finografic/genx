import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import fg from 'fast-glob';
import type { DetectedDesignSystem } from '../design-md.types.js';

const PANDA_CONFIG_NAMES = ['panda.config.ts', 'panda.config.mts', 'panda.config.js', 'panda.config.mjs'];

const CSS_IGNORE = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**', '**/coverage/**'];

/**
 * Where a project's own stylesheets live. Deliberately anchored at conventional
 * top-level directories rather than scanning the whole tree: a repository's
 * fixtures, demos, and example apps contain `@theme` blocks that are not its
 * design system. Scanning `**` made genx detect its own test fixtures as a
 * Tailwind project and offer the whole feature on that basis.
 */
const CSS_ROOTS = ['*.css', 'src/**/*.css', 'app/**/*.css', 'styles/**/*.css', 'assets/**/*.css'];

/** Find CSS files containing a Tailwind v4 `@theme` block, relative to targetDir. */
export function findTailwind4ThemeFiles(targetDir: string): string[] {
  const cssFiles = fg.sync(CSS_ROOTS, { cwd: targetDir, ignore: CSS_IGNORE, dot: false });
  return cssFiles.filter((file) => {
    try {
      return /@theme\b/.test(readFileSync(join(targetDir, file), 'utf8'));
    } catch {
      return false;
    }
  });
}

/**
 * Detect supported design systems in a target project, most-specific first.
 * PandaCSS wins over Tailwind v4 when both are present (a Panda project's CSS
 * layer is generated, not authored).
 */
export function detectDesignSystems(targetDir: string): DetectedDesignSystem[] {
  const detected: DetectedDesignSystem[] = [];

  const pandaConfig = PANDA_CONFIG_NAMES.find((name) => existsSync(join(targetDir, name)));
  if (pandaConfig) {
    detected.push({ framework: 'pandacss', sourceFiles: [pandaConfig] });
  }

  const themeFiles = findTailwind4ThemeFiles(targetDir);
  if (themeFiles.length > 0) {
    detected.push({ framework: 'tailwind4', sourceFiles: themeFiles });
  }

  return detected;
}
