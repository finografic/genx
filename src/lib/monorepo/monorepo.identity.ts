import { existsSync } from 'node:fs';
import { copyFile, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { PackageJson } from 'types/package-json.types';

export interface MonorepoIdentity {
  /** Package scope, with or without a leading `@`. */
  scope: string;
  /** Workspace name, without scope. */
  name: string;
  description: string;
  author: { name: string; email: string; url: string };
}

export interface ApplyMonorepoIdentityOptions {
  /** Absolute path of the freshly cloned workspace. */
  targetDir: string;
  /** Absolute path of `_templates/` — source of the reset project-memory files. */
  templateDir: string;
  identity: MonorepoIdentity;
  /** Node/pnpm versions from `@finografic/deps-policy`. */
  toolchain: { node: string; pnpm: string };
  /** `docs/todo/` filename prefixes to delete (starter build history). */
  docsTodoResetPrefixes: readonly string[];
}

/** Keywords carried by the starter that must not survive into a generated workspace. */
const STARTER_ONLY_KEYWORDS = new Set(['starter']);

function normalizeScope(scope: string): string {
  return scope.startsWith('@') ? scope : `@${scope}`;
}

/**
 * Rewrite the workspace root `package.json`: identity fields and policy toolchain only.
 *
 * `private`, `scripts`, `dependencies`, `devDependencies` and `lint-staged` are deliberately left
 * untouched — they are the starter's working configuration, not its identity.
 */
export async function rewriteRootPackageJson(
  targetDir: string,
  identity: MonorepoIdentity,
  toolchain: { node: string; pnpm: string },
): Promise<void> {
  const pkgPath = join(targetDir, 'package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8')) as PackageJson;

  const scope = normalizeScope(identity.scope);
  const scopeClean = scope.slice(1);
  const repoUrl = `https://github.com/${scopeClean}/${identity.name}`;

  pkg['name'] = `${scope}/${identity.name}`;
  pkg['version'] = '0.1.0';
  pkg['description'] = identity.description;

  const existingKeywords = Array.isArray(pkg.keywords)
    ? pkg.keywords.filter((keyword): keyword is string => typeof keyword === 'string')
    : [];
  pkg['keywords'] = [
    ...new Set([scopeClean, ...existingKeywords.filter((k) => !STARTER_ONLY_KEYWORDS.has(k))]),
  ];

  pkg['homepage'] = repoUrl;
  pkg['bugs'] = { url: `${repoUrl}/issues` };
  pkg['repository'] = { type: 'git', url: `git+${repoUrl}.git` };

  pkg['author'] = {
    name: identity.author.name,
    email: identity.author.email,
    ...(identity.author.url ? { url: identity.author.url } : {}),
  };

  const engines = (pkg['engines'] ?? {}) as Record<string, string>;
  engines['node'] = `>=${toolchain.node}`;
  engines['pnpm'] = `>=${toolchain.pnpm}`;
  pkg['engines'] = engines;
  pkg['packageManager'] = `pnpm@${toolchain.pnpm}`;

  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  await writeFile(join(targetDir, '.nvmrc'), `${toolchain.node}\n`, 'utf8');
}

/**
 * Replace the starter's README with a workspace-shaped stub.
 *
 * Not derived from `_templates/README.md` — that one is library-shaped (`pnpm add`, a single
 * import) and says nothing true about a monorepo.
 */
export function buildMonorepoReadme(identity: MonorepoIdentity): string {
  const scope = normalizeScope(identity.scope);
  const packageName = `${scope}/${identity.name}`;
  const authorLine = identity.author.url
    ? `MIT © [${identity.author.name}](${identity.author.url})`
    : `MIT © ${identity.author.name}`;

  return `# ${packageName}

> ${identity.description}

## Quick start

\`\`\`bash
pnpm install
cp .env.example .env.development
pnpm dev:db:reset
pnpm dev
\`\`\`

\`genx create monorepo\` runs the first three for you — \`pnpm dev\` should work straight away.

## Workspace

| Path | Package | Purpose |
| --- | --- | --- |
| \`apps/client\` | \`@workspace/client\` | Vite + React + React Router front end |
| \`apps/server\` | \`@workspace/server\` | Hono + Drizzle API server |
| \`packages/ui\` | \`@workspace/ui\` | shadcn + Tailwind component library |
| \`config\` | \`@workspace/config\` | Shared Valibot-validated environment config |

## Scripts

| Script | Purpose |
| --- | --- |
| \`pnpm dev\` | Run client and server together |
| \`pnpm build\` | Build every workspace package |
| \`pnpm test\` | Run tests across the workspace |
| \`pnpm typecheck\` | Typecheck every workspace package |
| \`pnpm lint\` / \`pnpm lint:fix\` | oxlint |
| \`pnpm format:check\` / \`pnpm format:fix\` | oxfmt |
| \`pnpm db:reset\` | Drop, recreate and seed the database |

**Note:** Git hooks are configured automatically on \`pnpm install\`.

## License

${authorLine}
`;
}

/**
 * Reset project memory and planning docs to their template state — the starter's own handoff,
 * session log and TODO/DONE history do not describe the generated project.
 */
export async function resetProjectMemory(
  targetDir: string,
  templateDir: string,
  docsTodoResetPrefixes: readonly string[],
): Promise<void> {
  for (const relativePath of ['.agents/handoff.md', '.agents/memory.md']) {
    const source = join(templateDir, relativePath);
    if (existsSync(source)) {
      await copyFile(source, join(targetDir, relativePath));
    }
  }

  const docsTodoDir = join(targetDir, 'docs/todo');
  if (existsSync(docsTodoDir)) {
    const entries = await readdir(docsTodoDir);
    for (const entry of entries) {
      if (docsTodoResetPrefixes.some((prefix) => entry.startsWith(prefix))) {
        await rm(join(docsTodoDir, entry), { force: true });
      }
    }

    const roadmapTemplate = join(templateDir, 'docs/todo/ROADMAP.md');
    if (existsSync(roadmapTemplate)) {
      await copyFile(roadmapTemplate, join(docsTodoDir, 'ROADMAP.md'));
    }
  }
}

/**
 * Apply every identity transform to a freshly cloned workspace.
 *
 * `apps/**`, `packages/**` and `config/**` are deliberately untouched — including the internal
 * `@workspace/*` scope, which is already generic and is referenced by tsconfig path aliases and
 * root `turbo --filter` scripts.
 *
 * @returns Repo-relative paths that were rewritten, in apply order.
 */
export async function applyMonorepoIdentity({
  targetDir,
  templateDir,
  identity,
  toolchain,
  docsTodoResetPrefixes,
}: ApplyMonorepoIdentityOptions): Promise<string[]> {
  await rewriteRootPackageJson(targetDir, identity, toolchain);
  await writeFile(join(targetDir, 'README.md'), buildMonorepoReadme(identity), 'utf8');
  await resetProjectMemory(targetDir, templateDir, docsTodoResetPrefixes);

  return ['package.json', '.nvmrc', 'README.md', '.agents/handoff.md', '.agents/memory.md', 'docs/todo/'];
}
