# Monorepo Generation

How `genx create monorepo` works, why it is built this way, and what to do when the starter
changes. Command usage lives in the README (generated from `create-monorepo.help.ts`) and in
`genx create monorepo --help`; this document is the architecture and maintenance reference.

---

## The split

Two jobs are easy to conflate:

| Job                           | Owner                        | Cadence          |
| ----------------------------- | ---------------------------- | ---------------- |
| Scaffold a monorepo           | `genx create monorepo`       | Once per project |
| Maintain toolchain + features | `genx upgrade` / `genx deps` | Continuously     |

Only the first is new. Generated monorepos are added to the managed list and then receive the same
`upgrade` / `deps` / `audit` treatment as every other `@finografic` package.

## The template is a repository, not `_templates/`

`_templates/` is the canonical source for **package** scaffolding and merging (see
`docs/TEMPLATE_SOURCES_AND_AGENTS_MERGE.md`). It is deliberately thin: config files plus a single
`src/index.ts`.

The monorepo template is the **`monorepo-starter` repository**, cloned at a tag.

Why not vendor it into `_templates/`:

- A monorepo template is a full application — Hono, Drizzle, Auth.js, shadcn, React. As inert
  template files it cannot be built, typechecked, run, or tested, so it rots silently and breakage
  surfaces only after someone generates from it.
- It would chain genx's release cadence to app-framework churn.

`monorepo-starter` stays a real app that builds and runs. That is what makes it trustworthy as a
template. The cost is that generation reaches the network to resolve which tag to clone.

## Workspace kind is not a package type

A monorepo root is **not** a fifth entry in `KNOWN_PACKAGE_TYPE_IDS`
([`src/lib/package-type.utils.ts`](../../src/lib/package-type.utils.ts)).

That list feeds `genx:type:*` keywords, `inferPackageTypeId`, and `isFrontendPackageType`, all of
which every feature's detect/apply consults. Package type classifies **a package**; workspace kind
describes **a repository layout**. They are orthogonal, and merging them would force a
"root or member?" branch into every feature.

If a marker becomes necessary, it is `genx:workspace:monorepo` on the root, with member packages
keeping ordinary `genx:type:*` keywords.

## What generation touches

Defined by the identity transform in
[`src/lib/monorepo/monorepo.identity.ts`](../../src/lib/monorepo/monorepo.identity.ts).

**Rewritten:**

| Path                                      | Change                                                                                                                             |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `package.json` (root)                     | `name`, `version`, `description`, `keywords`, `homepage`, `bugs`, `repository`, `author`, plus policy `engines` / `packageManager` |
| `.nvmrc`                                  | Node version from deps-policy                                                                                                      |
| `README.md`                               | Replaced with a workspace-shaped stub                                                                                              |
| `.agents/handoff.md`, `.agents/memory.md` | Reset from `_templates/.agents/`                                                                                                   |
| `docs/todo/`                              | `TODO_*.md` and `DONE_*.md` deleted; `ROADMAP.md` reset from `_templates/`                                                         |
| `.git/`                                   | Removed, then re-initialised with a `🌱 Genesis` commit                                                                            |

**Deliberately untouched:** `apps/**`, `packages/**`, `config/**`, root `scripts`, all
dependencies, and `lint-staged`. Those are the starter's working configuration, not its identity.

### The `@workspace/*` scope stays

Internal packages keep `@workspace/client`, `@workspace/server`, `@workspace/ui`,
`@workspace/config`. The scope is already generic (shadcn convention) and is referenced by
`tsconfig.json` path aliases and root `turbo --filter` scripts.

Renaming it would touch ~38 files for no benefit. Keeping it also means every generated monorepo
shares identical member names, which makes future member iteration predictable rather than
per-repo. Do not add renaming without a concrete reason.

## Which features generation applies

After install, generation applies only `monorepoConfig.rootFeatures`
([`src/config/monorepo.config.ts`](../../src/config/monorepo.config.ts)):
`aiAgents`, `aiInstructions`, `aiMemory`, `designMd`.

These write documentation and agent content only — markdown, `.agents/`, `.cursor/rules`,
`.github/copilot-instructions.md`, `.gitignore`. They read the root `package.json` for template
variables but never mutate it.

Everything else is excluded, in two groups:

| Excluded                             | Why                                                                                                                                                                                                                                                                                          |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `oxc-config`, `markdown`, `gitHooks` | Canonical content is written for a single package. `oxc-config` rewrites `update:oxc-config` **without `--recursive`**, silently dropping workspace members from updates, and replaces the root `oxlint.config.ts` with the _library_ preset. The starter already owns all three, correctly. |
| `vitest`, `css`, `reactVite`         | Assume a single-package `src/` layout; they need to run per workspace member.                                                                                                                                                                                                                |

### Why toolchain config is the starter's job, not generation's

The starter is itself a genx-managed repo. At any tagged commit it is already in the state you
want — that is what tagging it means. Re-deriving that state at generation time, from
package-shaped templates, can only make it worse.

So when the starter falls behind current conventions, the fix is upstream: run `genx upgrade` on
`monorepo-starter`, accept what belongs there, then `pnpm release:github:<patch|minor>`, which bumps
and tags in one step. Generation picks the new tag up immediately — no genx change, no release. Every
generated workspace inherits the result, and you review those diffs once instead of on every
generation.

**Known outstanding example:** the starter still carries the legacy `.github/instructions/` layout
and has no `.agents/instructions/` or `.agents/skills/`. `aiInstructions` and `aiAgents` migrate
this at generation time today; doing it in the starter would make that a no-op.

## Environment bootstrap

After install, generation prepares the workspace so `pnpm dev` works immediately:

1. Copy `.env.example` → `.env.development` (the target the starter's own `.env.example` names),
   replacing the shipped `AUTH_SECRET` placeholder with a freshly generated 32-character value so
   no two workspaces share a secret. An existing `.env.development` is never overwritten.
2. Run `pnpm dev:db:reset` to create, migrate and seed the database.

Both are skipped by `--no-install` (they need `node_modules`) and both are non-fatal — a failure is
reported with the command to run by hand, since the workspace is already valid without them.

## Choosing the starter tag

A cloned tag is the **only** source. Resolution order, highest precedence first:

| Source                   | Set by                                                      | Use when                                         |
| ------------------------ | ----------------------------------------------------------- | ------------------------------------------------ |
| `--tag <tag>`            | Flag                                                        | One-off: pin a specific tag, or try a prerelease |
| `monorepoStarter.tag`    | `genx.config.jsonc`                                         | Pin every run on this machine to one tag         |
| **Newest tag on remote** | `git ls-remote`                                             | **Default**                                      |
| `pinnedTag`              | [`monorepo.config.ts`](../../src/config/monorepo.config.ts) | Fallback only — the remote could not be reached  |

```jsonc
// ~/.config/finografic/genx.config.jsonc
"monorepoStarter": {
  "tag": "v0.3.0",
},
```

The resolved tag is printed before generation starts, so neither an override nor a fallback is ever
silent.

### Why a tag is the only source

A tag is a version someone signed off as ready. A working tree is unreviewed state, and generation
should never quietly depend on it.

Generating from a local checkout was built and then removed. It needed its own file-selection
rules, and any hand-maintained approximation of `.gitignore` leaks — the implementation excluded
`node_modules`, `.git`, `.turbo` and `dist`, and still copied `.env.*`, the dev sqlite database and
`.claude/settings.local.json` into generated workspaces. Worse, an inherited `.env.development`
made `seedDevEnvFile` skip, so the workspace silently reused the starter's `AUTH_SECRET`.

A clone avoids all of that for free: untracked files are simply not in the commit. One source means
one code path, and that class of bug cannot recur.

**To try starter changes before releasing them, tag a prerelease** — `v0.3.0-rc.1`, then
`genx create monorepo --tag v0.3.0-rc.1`. Tag ordering ranks a prerelease below its release, so an
`-rc` tag is never selected by `--tag latest`.

### Why the default is the newest tag rather than a pin

Tagging the starter **is** the sign-off. A pin inside genx would be a second gate asserting the same
thing, and one nothing obliges anyone to update — so it goes stale the moment the starter is tagged,
quietly generating from an older starter than the one just released. That is not hypothetical: the
pin fell behind within hours of `v0.2.2`, with no signal, and was noticed only by chance.

Resolving the newest tag removes the duplicate decision. Generation is still never based on
unreviewed state, because an untagged commit is never selectable.

The cost is that generation needs network and SSH. When the lookup fails, `pinnedTag` still produces
a valid workspace, and the run reports `remote unreachable — falling back to this release's pin` so
a stale source is never mistaken for a deliberate one.

To pin deliberately, use `--tag` for one run or `monorepoStarter.tag` for every run on a machine.

## Maintenance

### Releasing a starter change

1. Land the change in `monorepo-starter`.
2. `pnpm release:github:<patch|minor|major>` — gates on the starter's own checks, then bumps,
   tags and pushes in one step.
3. Generate into a scratch directory and confirm the result installs and runs.

There is no genx-side step: the next generation resolves the new tag on its own. Only refresh
`pinnedTag` when the offline fallback has drifted far enough to be worth updating, which is a
convenience, not a correctness requirement.

### When the starter's layout changes

The transform makes assumptions that a starter restructure can break:

- Root `package.json` carries the identity fields listed above.
- `.agents/handoff.md`, `.agents/memory.md` and `docs/todo/` exist.
- The workspace/scripts tables in the generated README describe the real layout — these are
  hardcoded in `buildMonorepoReadme` and will drift if apps or packages are added or renamed.

`src/lib/monorepo/monorepo.identity.test.ts` covers the transform against a fixture tree, so a
starter restructure will not be caught by tests. Regenerate into a scratch directory after any
structural change to the starter.

## Planned work

Detail and locked decisions: [`docs/todo/DONE_MONOREPO_GENERATOR.md`](../todo/DONE_MONOREPO_GENERATOR.md).

- **v1 — workspace-aware upgrade.** `genx:workspace:monorepo` marker plus member iteration over
  `pnpm-workspace.yaml`, so package-scoped features can run.
- **v2 — slices.** Reduce the starter to a minimal core plus additive overlays
  (`_slices/auth/`, `_slices/i18n/`, `_slices/design-system-<x>/`). Additive rather than
  subtractive: auth spans server files, client context, pages, db schemas and routes, so
  post-clone deletion leaves dangling imports. Gated on real demand.
