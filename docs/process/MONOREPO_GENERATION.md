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

The monorepo template is the **`monorepo-starter` repository**, cloned at a pinned tag.

Why not vendor it into `_templates/`:

- A monorepo template is a full application — Hono, Drizzle, Auth.js, shadcn, React. As inert
  template files it cannot be built, typechecked, run, or tested, so it rots silently and breakage
  surfaces only after someone generates from it.
- It would chain genx's release cadence to app-framework churn.

`monorepo-starter` stays a real app that builds and runs. That is what makes it trustworthy as a
template. The cost is that generation requires network access and a pinned tag.

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

## Root-scoped vs package-scoped features

After install, generation applies only the features in `monorepoConfig.rootFeatures`
([`src/config/monorepo.config.ts`](../../src/config/monorepo.config.ts)):

`oxc-config`, `markdown`, `gitHooks`, `aiAgents`, `aiInstructions`, `aiMemory`, `designMd`.

Excluded: `vitest`, `css`, `reactVite` — these assume a single-package `src/` layout and would need
to run per workspace member. Until `upgrade` iterates members, they are left out rather than
applied incorrectly at the root.

## Maintenance

### Bumping the pinned tag

1. Land the change in `monorepo-starter` and tag it (`vX.Y.Z`).
2. Update `pinnedTag` in [`src/config/monorepo.config.ts`](../../src/config/monorepo.config.ts).
3. Generate into a scratch directory and confirm the result installs and runs.

The tag is bumped **manually and deliberately** — never track a branch. Generation must be
reproducible for a given genx version.

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

Detail and locked decisions: [`docs/todo/TODO_MONOREPO_GENERATOR.md`](../todo/TODO_MONOREPO_GENERATOR.md).

- **v1 — workspace-aware upgrade.** `genx:workspace:monorepo` marker plus member iteration over
  `pnpm-workspace.yaml`, so package-scoped features can run.
- **v2 — slices.** Reduce the starter to a minimal core plus additive overlays
  (`_slices/auth/`, `_slices/i18n/`, `_slices/design-system-<x>/`). Additive rather than
  subtractive: auth spans server files, client context, pages, db schemas and routes, so
  post-clone deletion leaves dangling imports. Gated on real demand.
