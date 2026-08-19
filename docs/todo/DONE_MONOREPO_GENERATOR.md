# DONE — `genx create monorepo` (v0 + v1)

> **Status:** v0 shipped 2026-08-17; v1 (workspace-aware upgrade) shipped and verified end to end
> 2026-08-19. Only v2 (slices) remains, parked in ROADMAP P3 pending real demand.
> Living reference: [`docs/process/MONOREPO_GENERATION.md`](../process/MONOREPO_GENERATION.md).
>
> **Primary repository:** this repo (`@finografic/genx`)
>
> **Template source:** `finografic/monorepo-starter` (a real, running app — not `_templates/`)
>
> **Origin:** 2026-08-16 session — "how best to approach monorepo generation".

## Outcome

`genx create monorepo <name>` produces a new, installable, running full-stack monorepo from a
pinned `monorepo-starter` tag, with root identity rewritten, toolchain aligned to deps-policy,
and a clean git history — replacing today's "copy `monorepo-starter` by hand and delete things".

## Architecture Decision (locked)

| Layer                             | Owner                                | Why                                                                                                     |
| --------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Monorepo content (apps, packages) | `monorepo-starter`                   | Stays a real app that builds, typechecks and runs; inert template copies inside genx would rot silently |
| Generation orchestration          | **genx (`create monorepo`)**         | Already owns prompts, preview/confirm, deps-policy, feature apply, managed loop                         |
| Toolchain / feature maintenance   | **genx (`upgrade` / `deps`)**        | Already works — `monorepo-starter` is in the managed list today                                         |
| Package identity (`genx:type:*`)  | per-member `package.json`, unchanged | Workspace kind is orthogonal to package type                                                            |

**Explicitly rejected:**

- **A 5th package type (`monorepo`) in `PACKAGE_TYPES`.** `KNOWN_PACKAGE_TYPE_IDS`
  ([`src/lib/package-type.utils.ts`](../../src/lib/package-type.utils.ts)) feeds `genx:type:*`,
  `inferPackageTypeId` and `isFrontendPackageType`, all consulted by every feature's detect/apply.
  A workspace root is not a package type; merging the axes forces "root or member?" branching into
  every feature. If a marker is needed later it is `genx:workspace:monorepo` on the root, with
  members keeping ordinary `genx:type:*`.
- **Vendoring the starter into `_templates/`.** `_templates/` is deliberately thin (config +
  `src/index.ts`). Carrying Hono + Drizzle + Auth.js + shadcn + React 19 as inert files makes them
  unrunnable and untestable, and chains genx releases to app-framework churn.
- **Building the generator inside `monorepo-starter`.** Makes the starter simultaneously a runnable
  app and a published CLI (own lint/build/deps surface) and duplicates genx's preview/merge
  machinery.

## v0 Scope

Clone + identity rewrite + toolchain align. **No feature options, no subtraction.**

| Step | Behaviour                                                                                                |
| ---- | -------------------------------------------------------------------------------------------------------- |
| 1    | Prompt: name, description, author (reuse the manifest half of `promptCreatePackage`). No feature picker. |
| 2    | Validate target dir (`validateTargetDir`)                                                                |
| 3    | `git clone --depth 1 --branch <PINNED_TAG>` the starter, then remove `.git`                              |
| 4    | Apply the identity transform manifest (below)                                                            |
| 5    | Toolchain from deps-policy: `engines.node`, `packageManager`, `.nvmrc` (mirrors `create.cli.ts`)         |
| 6    | `pnpm install` (skippable via `--no-install`)                                                            |
| 7    | Apply root-scoped features only (allowlist below)                                                        |
| 8    | `git init` + `git add .` + `🌱 Genesis` commit                                                           |
| 9    | Print the managed-config block to paste into `~/.config/finografic/genx.config.jsonc`                    |

### Key simplification: keep `@workspace/*`

The starter's internal scope is already generic (`@workspace/client`, `@workspace/server`,
`@workspace/ui`, `@workspace/config` — shadcn convention), referenced in 38 files including
`tsconfig.json` path aliases and root `turbo --filter` scripts. **Do not rename it.** Keeping it
means zero rewrite risk in v0, and every generated monorepo shares identical internal package
names — which makes future genx member-iteration predictable rather than per-repo.

Renaming is therefore not a v0 requirement and should not be added without a concrete reason.

### Identity transform manifest

| Path                                      | Action                                                                                                                                                                                         |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json` (root)                     | Rewrite `name`, `description`, `keywords`, `homepage`, `bugs`, `repository`, `author`. Keep `private: true`, all `scripts`, all deps                                                           |
| `README.md`                               | Replace with a workspace-shaped stub (quickstart, workspace table, scripts table). Not derived from `_templates/README.md` — that one is library-shaped and says nothing true about a monorepo |
| `.agents/handoff.md`, `.agents/memory.md` | Reset from `_templates/.agents/` — the starter's are 94 + 84 lines of starter-specific history                                                                                                 |
| `docs/todo/`                              | Delete every `TODO_*.md` and `DONE_*.md` (starter build history — `TODO_POSTGRES_MIGRATION.md` is as starter-specific as the `TODO_PHASE_*` files); reset `ROADMAP.md` from `_templates/`      |
| `AGENTS.md`, `CLAUDE.md`                  | Leave as-is in v0; `genx upgrade` normalises the spine afterwards                                                                                                                              |
| `.git/`                                   | Removed, re-initialised                                                                                                                                                                        |
| `apps/**`, `packages/**`, `config/**`     | **Untouched**                                                                                                                                                                                  |
| `.env*`                                   | Nothing to do — only `.env.example` is tracked (`.gitignore` has `.env.*` + `!.env.example`)                                                                                                   |

### Root-scoped feature allowlist

Apply: `oxc-config`, `markdown`, `gitHooks`, `aiAgents`, `aiInstructions`, `aiMemory`, `designMd`.

Exclude: `vitest`, `css`, `reactVite` — these assume a single-package `src/` layout.

These root paths are already exercised: `@finografic/monorepo-starter` is in the managed list and
receives `genx upgrade` today. Confirm during implementation rather than assuming, but the risk is
low and the evidence is real.

## Non-goals (v0)

- Feature/slice options (auth, i18n, design-system choice) — see v2
- Any deletion of app code
- Renaming `@workspace/*`
- `gh repo create` / remote setup
- Workspace-member iteration in `upgrade` — see v1

## Implementation map

| File                                          | Change                                                                                         |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/cli.ts`                                  | No change — `create` already routes; subcommand dispatch happens inside                        |
| `src/commands/create/create.cli.ts`           | Dispatch `argv[0] === 'monorepo'` → `createMonorepo` before `withHelp` / `promptCreatePackage` |
| `src/commands/create/create-monorepo.cli.ts`  | New — the v0 pipeline above                                                                    |
| `src/commands/create/create-monorepo.help.ts` | New — `CommandHelpConfig`; picked up by `scripts/generate-readme-usage.ts`                     |
| `src/config/monorepo.config.ts`               | New — starter repo URL, `PINNED_TAG`, root-feature allowlist, reset manifest                   |
| `src/lib/monorepo/clone.ts`                   | New — shallow clone at tag, strip `.git`, clear error if the tag is missing                    |
| `src/lib/monorepo/identity.transform.ts`      | New — manifest application; unit-testable against a fixture tree                               |
| `src/utils/prompts.ts`                        | Add `promptCreateMonorepo` (manifest fields only)                                              |
| `src/cli.help.ts`                             | Add the `create monorepo` usage line                                                           |

## Status

**v0 and v1 are both shipped and verified end to end** (2026-08-19, genx 5.48.4 against
`monorepo-starter` v0.4.4).

The verification run covered generation, `pnpm db:setup` in the generated repo, and a full
interactive `genx upgrade` confirming all three feature buckets: root features applied at the
workspace root only, `vitest` applied per selected member with its own diffs, and `oxc-config`
reported as skipped rather than written. `.gitignore` proposed no change, confirming the canonical
merge is a fixed point for the starter.

Four defects surfaced by that interactive run — none reachable from unit tests — were fixed in
5.48.4: the react `vitest.config.ts` template was unreachable, React members got
`environment: 'node'`, per-member commits shared one indistinguishable subject, and
`Upgrade complete` printed before member work began.

## Prerequisites in `monorepo-starter`

Both satisfied. The repo is tagged (`v0.4.4` at time of verification) and generator-visible changes
get a tag bump; `apps/server` boots in a fresh clone — the `.env.development` symlink that makes
`pnpm db:setup` work is now tracked, via a `.gitignore` negation under `# Project-specific`.

## Decisions (locked 2026-08-16)

| #   | Decision                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Do not auto-write** `~/.config/finografic/genx.config.jsonc`. The file has hand-maintained comment dividers; comment-preserving JSONC writing is its own task. Print the block to paste. |
| 2   | **Pin to a tag**, never a branch — generation must be reproducible.                                                                                                                        |
| 3   | `PINNED_TAG` is bumped **manually** in `monorepo.config.ts`, as a deliberate genx release decision.                                                                                        |
| 4   | Clone with **`git clone --depth 1` over SSH** — matches existing repo access, no extra dependency.                                                                                         |
| 5   | **`pnpm install` by default**, with `--no-install` to skip. A non-installed monorepo is not verifiably working.                                                                            |

## Later phases (do not build speculatively)

**v1 — workspace-aware upgrade. Shipped 2026-08-19.** The `genx:workspace:monorepo` root marker,
`pnpm-workspace.yaml` member resolution, and the root / member / blocked feature partition all
landed; see the Status section above. One detection subtlety is worth remembering: since pnpm 10 a
single-package repo may carry a `pnpm-workspace.yaml` for `allowBuilds`, so a workspace requires a
non-empty `packages:` list, not merely the file.

**v2 — slices.** Reduce the starter to a minimal core plus additive overlays
(`_slices/auth/`, `_slices/i18n/`, `_slices/design-system-<x>/`) that copy in and merge.
Additive, not subtractive: auth currently spans ~15 server files plus client context, pages, db
schemas and routes, so post-clone deletion leaves dangling imports. Side benefit — starter CI can
generate core / core+auth / core+auth+i18n and typecheck each, making the slices tested.

Gate v2 on real demand from the first two or three generated monorepos. Which options are actually
wanted is not yet known.
