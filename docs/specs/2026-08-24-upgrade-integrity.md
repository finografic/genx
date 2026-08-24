# `genx upgrade` Integrity Pass

**Date:** 2026-08-24
**Status:** Shipped (5.53.0 – 5.54.3)
**Roadmap:** [`ROADMAP.md`](../todo/ROADMAP.md) Done

## What this records

Fourteen defects in `genx upgrade`, found in one afternoon by running the command against a real
repository (`cv-justin-rankin`) and reading every diff it proposed. Unit tests, typecheck, lint and
markdown lint were green throughout, before and after each fix.

This document exists for the pattern, not the changelog. The individual fixes are in the git history.

## The shape almost all of them shared

**A blanket writer claimed a key that a feature already owned, and won by overwriting.**

| Blanket writer                    | Key it claimed                                    | Real owner                           |
| --------------------------------- | ------------------------------------------------- | ------------------------------------ |
| `sharedConfig.lintStaged`         | `*.md`                                            | `markdown` feature (`md-lint --fix`) |
| `sharedConfig.packageJsonScripts` | `test`, `test:run`, `test:coverage`               | `vitest` feature                     |
| `hooks` upgrade operation         | `.husky/*`, `commitlint.config.mjs`               | `gitHooks` feature                   |
| `dependencyRules` (non-optional)  | `vitest`, `tsdown`, `@finografic/project-scripts` | the project                          |
| `patchPackageJson`                | every script whose value differed                 | the project                          |

The consequence was always the same: a deliberate decision replaced by a default, silently. A
project's `prepare: "husky && pnpm panda:codegen"` became a bare `"husky"`. `format:check` vanished
from a project's `release:check`. Markdown linting was switched off in a repository that had it —
in lint-staged _and_ in CI, by two unrelated code paths on the same run.

**Rule adopted:** the feature that owns a file owns its migration and its maintenance. A blanket
writer may add what is missing; it may not overwrite what is there.

## The second shape: guarding on state that does not exist yet

`ai-instructions` retires `.github/instructions/`. The first implementation guarded it on
`.agents/instructions/` existing on disk — inside a _preview_, where that directory is only
proposed. The guard was false in exactly the case the code existed for, so the retirement did
nothing on a first migration and worked only where it was not needed.

Its unit tests passed throughout, because they called the collector directly with a canonical tree
already on disk. **The fault was in the wiring, not the logic**, and only an end-to-end run through
`applyAiInstructions` exposed it.

**Rule adopted:** a preview must reason about proposed state, not just disk state. Where a decision
depends on what this run is about to write, pass that set in — see `plannedCanonicalPaths`.

## Behaviour changes worth knowing

- **Every operation previews and confirms.** `workflows` and `docs` used to copy over the top with
  no diff and no prompt; five of seven operations asked first and two did not, so the menu could not
  be trusted as a whole. A file already matching the template now produces no output at all.
- **`-y` works.** It reached only features applied to workspace members. Operations built a fresh
  confirm state that never saw the flag, and root features did not get it either.
- **The `hooks` operation is gone**, along with the dead `oxc-config` section. There is no `--only`
  flag and there never was; the comment claiming `--only merges` worked was wrong.
- **Added scripts land in their canonical section**, read from `_templates/package.json` rather than
  a restated map. Section headings match by name — divider characters differ per repository, and the
  first section deliberately uses a different one as an `ntl` wrap marker.
- **A trailing-newline-only difference is normalised silently.** It changes no content, so there is
  nothing to decide, and prompting about it every run was unclearable noise.
- **Commits are scoped.** The skills install ran `git add -A` at the end of a run that leaves the
  tree dirty by design, filing every operation's work under a `chore(skills)` subject.

## Method note

Every one of the fourteen came from running the real command against a real repository and reading
the output. None came from the test suite. The tests were added _after_ each defect, to pin it.

The same note appears in the 2026-08-19 session log. It has now been true twice, for two different
subsystems, which makes it a property of this codebase rather than a coincidence: **genx's failure
modes live in wiring and ownership, and those are only visible end to end.**
