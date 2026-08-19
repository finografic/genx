# Workspace Ownership Model

**Date:** 2026-08-19
**Status:** Draft
**Roadmap:** [`ROADMAP.md`](../todo/ROADMAP.md) #11

## Goal

Decide what a monorepo workspace root owns, so that `genx upgrade` routes every write by **who owns
the file** rather than by where the command happened to be run.

Monorepo v1 (shipped 2026-08-19) partitions _features_ into root / member / blocked. _Operations_
were never scoped: `package-json`, `dependencies`, `node`, `renames`, `hooks`, `workflows`, `docs`
and `gitignore` all run against the workspace root as though it were an ordinary package. That is
inherited default behaviour, not a decision — and it has never been exercised, since the v1
verification run selected only `gitignore`.

## Non-Goals

- **v2 slices.** Additive starter overlays remain parked in ROADMAP P3, gated on real demand.
- **Migrating the starter to pnpm catalogs.** Noted below as the likely long-term answer, but it is
  a starter migration, not part of this model.
- **Changing what any feature writes.** This spec decides _where_ things run, not their content.
- **`genx create`.** Generation already applies `monorepoConfig.rootFeatures` and is verified.

## Decision Summary

| #   | Decision                                                                                                                                                               | State    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Route by **ownership**, not location. "Root vs recursive" is an emergent property of the ownership table, never a mode the user selects.                               | Proposed |
| 2   | Scope is a **set**, not a single value: `root \| member \| both \| starter-owned`.                                                                                     | Proposed |
| 3   | Do **not** force `upgrade` to run per package. Workspace singletons would be applied N times, and member iteration already works.                                      | Proposed |
| 4   | Operations must **declare** a scope, exhaustively, so a new one cannot silently default.                                                                               | Proposed |
| 5   | `deps` aligns each package against policy (vertical); `syncpack` verifies packages against each other (horizontal). No coordination between the two tools is required. | Proposed |
| 6   | Whether the root should receive genx-canonical toolchain config, or stay starter-owned, is unresolved — see Open Questions.                                            | **Open** |

## Architecture

### The unit is ownership

Every file genx writes has exactly one owner:

| Owner           | Meaning                                                             |
| --------------- | ------------------------------------------------------------------- |
| `root`          | A workspace-level singleton — one per repo                          |
| `member`        | Belongs to an individual package                                    |
| `both`          | A root artifact _and_ a per-package artifact, with distinct content |
| `starter-owned` | The starter owns it; genx must not write it, and says so            |

`both` does not exist today. The recursive `AGENTS.md` work will need it — a root spine plus
per-package files — and the current exclusive partition cannot express that. This should land
**before** that work begins, not during it, so that two new behaviours are not being debugged at
once.

### Ownership of the current operations

Proposed, from inspecting a generated monorepo (starter v0.4.4):

| Operation      | Owner | Reasoning                                                                       |
| -------------- | ----- | ------------------------------------------------------------------------------- |
| `gitignore`    | root  | One file, git-level                                                             |
| `workflows`    | root  | `.github/` exists once                                                          |
| `hooks`        | root  | husky installs once, at the repo root                                           |
| `docs`         | root  | Repo-level documentation structure                                              |
| `renames`      | root  | Canonical filenames, wherever they are                                          |
| `node`         | both  | One `.nvmrc`; `engines.node` belongs to every manifest                          |
| `package-json` | both  | Root scripts are turbo orchestration; member scripts are the real ones          |
| `dependencies` | both  | Each manifest has its own — **including the root**, which is not an empty shell |

The root of the generated starter carries ~92 lines of real manifest, including `commitlint`,
`syncpack`, `@finografic/oxc-config` and `@types/node`, plus a direct `lint: oxlint` script. Treating
it as "not a package" is only half true: it is not _publishable_, but it is a real manifest with real
toolchain dependencies.

### Dependency alignment has two axes

|                | Question                                            | Owner       |
| -------------- | --------------------------------------------------- | ----------- |
| **Vertical**   | Is this package on the org's version of X?          | deps-policy |
| **Horizontal** | Do the packages in this repo agree with each other? | syncpack    |

If `genx deps` runs per member against a single policy, horizontal consistency falls out for free —
every package converges on the same version because they resolve from the same source. `syncpack`
(already in the starter at `^15.3.3`) then becomes a **CI verifier** of drift genx did not cause:
hand edits, a newly added package, a dependency policy does not cover.

pnpm `catalog:` would collapse both axes — policy writes the catalog once in `pnpm-workspace.yaml`
and packages reference it, making drift structurally impossible rather than checked. The starter
does not use catalogs today, so this is a migration to consider separately.

### Hazard: the `workspace:` protocol

Workspace-internal dependencies must never be policy-aligned. The generated starter has two —
`@workspace/ui` and `@workspace/config`, both `workspace:*`. Rewriting either to a semver range
breaks the workspace link. This is the one place recursion could actively damage a repo rather than
merely be untidy, so the guard must land in the same change that makes `dependencies` recurse.

## Migration Strategy

Incremental, each step independently shippable:

1. **Declare scopes, change nothing.** Give every operation an explicit scope, defaulting all to
   `root` — exactly today's runtime behaviour, now visible and typed. Make the mapping exhaustive so
   a new operation cannot default silently.
2. **Recurse `dependencies`**, with the `workspace:` protocol guard. This is the operation whose
   current behaviour is most clearly wrong.
3. **Add the `both` scope**, when the recursive `AGENTS.md` work needs it.
4. **Split `node` and `package-json`** into their root and member halves.
5. **Resolve the starter-owned question** (below), then reconsider catalogs.

## Open Questions

1. **Should the root receive genx-canonical toolchain config, or stay starter-owned?**
   `oxc-config` is currently skipped at the root as "the starter already owns it" — but the root
   genuinely _uses_ it (devDep plus a `lint: oxlint` script). The blocked bucket conflates two
   different reasons: "does not apply here" is terminal, while "someone else owns it" means the
   root's lint config drifts from genx canonical indefinitely with nothing to reconcile it. That is
   the same duplicated-value shape as Key Decision 17, except institutionalised as a skip.

2. **Which member set do root-scoped operations imply?** Today the member picker appears only when
   member-scoped _features_ are selected. If operations gain member scope, the picker needs to run
   for those too — and probably once, up front, rather than per concern.

3. **Does `managed upgrade` need anything?** The routing sits inside `upgradeSingleTarget`, so a
   cross-repo sweep inherits it. Worth confirming that a mixed sweep of monorepos and single
   packages does not prompt for members repeatedly.
