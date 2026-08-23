import type { CommandHelpConfig } from '@finografic/cli-kit/render-help';

import { monorepoConfig } from 'config/monorepo.config';

/**
 * `owner/repo` slug derived from the clone URL.
 *
 * Help text uses the slug rather than the full SSH URL: a bare `git@host:…` string trips
 * markdownlint MD034 (no-bare-urls) once the README generator renders it. The full URL stays in
 * `monorepo.config.ts`, which is where anyone needing it will look.
 */
const repoSlug = monorepoConfig.repoUrl.replace(/^git@github\.com:/, '').replace(/\.git$/, '');

/**
 * Render key/value pairs as an aligned section body.
 *
 * `scripts/generate-readme-usage.ts` only turns a section into a README table when *every* line
 * matches `key<2+ spaces>value`, and silently falls back to raw text otherwise — which renders as
 * run-on prose. Computing the padding keeps that invariant from breaking when a key is renamed to
 * something longer than the hand-typed alignment allowed for.
 */
function keyValueSection(rows: ReadonlyArray<readonly [string, string]>): string {
  const width = Math.max(...rows.map(([key]) => key.length));
  return rows.map(([key, value]) => `  ${key.padEnd(width)}  ${value}`).join('\n');
}

export const help: CommandHelpConfig = {
  command: 'genx create monorepo',
  description: 'Create a new full-stack monorepo from the newest monorepo-starter tag',
  usage: 'genx create monorepo [options]',
  options: [
    { flag: '--name <name>', description: 'Workspace name (without scope)' },
    { flag: '--tag <tag>', description: 'Pin a specific starter tag instead of the newest one' },
    { flag: '--no-install', description: 'Skip pnpm install, env seeding, and database setup' },
    { flag: '-y, --yes', description: 'Accept defaults without prompting' },
  ],
  examples: [
    { command: 'genx create monorepo', description: 'Create a new monorepo interactively' },
    {
      command: 'genx create monorepo --name my-app',
      description: 'Create a monorepo with a specific name',
    },
    {
      command: 'genx create monorepo --tag v0.2.0',
      description: 'Generate from a specific older tag',
    },
    {
      command: 'genx create monorepo --no-install',
      description: 'Scaffold without running pnpm install',
    },
  ],
  howItWorks: [
    'Prompts for workspace name, description, and author',
    `Clones ${repoSlug} at its newest tag and drops its git history`,
    'Rewrites root identity (package.json, README, project memory) — app code is untouched',
    'Applies policy toolchain versions and runs pnpm install',
    'Applies documentation/agent features only — toolchain config comes from the starter',
    'Seeds .env.development with a fresh AUTH_SECRET, then runs pnpm dev:db:reset',
    'Initializes a fresh git repository and prints the managed-config block to register it',
  ],
  sections: [
    {
      title: 'TEMPLATE SOURCE',
      content: keyValueSection([
        ['repo', repoSlug],
        ['tag', 'the newest tag on the remote, resolved at generation time'],
        ['why', 'the starter repo, not _templates/ — it stays a real app that builds and runs'],
        ['scope', 'internal packages keep the generic @workspace/* scope'],
        ['source', 'always a cloned tag — tagging the starter is the sign-off'],
        ['pin', '--tag, or monorepoStarter.tag in genx.config.jsonc'],
        ['offline', 'not supported — the clone needs the same remote the tag lookup does'],
        ['early', 'to try starter changes before release, tag a prerelease (v0.3.0-rc.1)'],
      ]),
    },
  ],
};
