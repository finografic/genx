# TODO.ROADMAP.md

Future enhancements identified during the deps-policy → genx → target pipeline walkthrough (2026-04-06).
Ordered roughly by dependency: earlier items are prerequisites for later ones.

---

## 1. `genx create` — apply resolvePolicy() immediately after scaffold

- [ ] status: pending

**Goal:** After scaffolding a new package, run `resolvePolicy(packageType)` and write the
resolved dependency versions directly into the new `package.json` instead of relying on the
hardcoded versions in `_templates/package.json`.

**Why:** `_templates/package.json` is a structural blueprint, not a version source of truth.
Newly created packages should get live versions from `@finografic/deps-policy` at scaffold time,
not stale versions baked into the template.

**Impact:** `_templates/package.json` dependency versions become irrelevant / can be cleared.
`genx create` already has access to `resolvePolicy()` through `dependencies.rules.ts`.

**Status:** Not started. Low risk — additive change to the create pipeline.

---

## 2. Type-specific policy divergence in deps-policy

- [ ] status: pending

**Goal:** Allow `library.ts` and `config.ts` in `@finografic/deps-policy` to intentionally
diverge from `base` where it makes sense (e.g., `config` packages probably do not need
`vitest` or `@types/node`).

**Why:** Currently both are empty, inheriting everything from `base` via `resolvePolicy`. As the
ecosystem matures, some package types legitimately need a different dep surface.

**Candidates:**

- `config` type: drop `vitest`, possibly `@types/node`
- `library` type: possibly add `@types/<something>` specific to the domain

**Status:** Deferred until concrete need arises. No urgency — empty files are correct today.

## 3. Husky template completion

- [ ] status: pending

**Goal:** Finish the Husky migration outside this local repo so new scaffolds and feature-driven
installs match the current local setup.

**What remains:**

- migrate `_templates/package.json` from `simple-git-hooks` to `husky`
- scaffold `.husky/pre-commit` in `_templates/`
- update the `git-hooks` feature so canonical output is Husky-based, not package.json
  `simple-git-hooks`
- update preview-driven detect/apply for `git-hooks` so detection checks the new Husky-owned files
  and `apply()` uses the same preview/change-set truth
- refresh docs/tests so `git-hooks` examples and expectations reference `husky`

**Why:** The local repo now uses Husky successfully, but generated projects and the feature module
still describe the old hook system. This is now mostly a parity/consistency pass.

**Status:** Pending. Local migration is done; template + feature alignment remains.

---

## Non-starters (excluded)

- **Auto-publish on version bump** — too much automation risk; manual release gates are intentional.
- **Removing `--only` from `migrate`** — `deps` command coexists as a fast path; `--only` retains
  value for other granular migrate operations (e.g. `--only=eslint`).
