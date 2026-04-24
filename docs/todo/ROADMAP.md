# ROADMAP.md

Future enhancements identified during the deps-policy → genx → target pipeline walkthrough (2026-04-06).
Updated 2026-04-24.
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

---

## 3. Husky template completion

- [x] status: **DONE**

**Status:** Done. Root + `_templates/` now use Husky with `.husky/pre-commit` and
`.husky/commit-msg`, the `git-hooks` feature preview/detect/apply flow is Husky-based, legacy
`simple-git-hooks` config is cleaned up, and docs/tests were updated to match.

---

## 4. `design-docs` genx feature

- [ ] status: pending

**Goal:** Add a `design-docs` feature to the genx feature registry that sets up the `docs/specs/`
and `docs/scratch/` directory structure, gitignore entry, triage script, and the
`12-design-specs.instructions.md` instruction file in any `@finografic` package.

**Why:** Agents across the ecosystem produce planning artifacts in ad-hoc locations without a
canonical structure. The triage system currently lives only in genx — it should be portable.

**What the feature would apply:**

- Create `docs/specs/` and `docs/scratch/` directories
- Add `docs/scratch/` to `.gitignore`
- Copy `scripts/triage-docs.ts` to target project (pending #6 portability decision)
- Add `triage:docs` script to `package.json`
- Copy `12-design-specs.instructions.md` to `.github/instructions/`
- Add triage-docs SKILL to `.github/skills/triage-docs/`
- Wire entries into `AGENTS.md` if the `ai-agents` feature is present (optional, graceful skip)

**Detection:** Preview-driven — compute canonical state of all owned files, diff against disk.

**Status:** Not started. Blocked on #6 (triage-docs portability).

---

## 5. `generate-new-genx-feature` skill — modernize for diff-as-detection

- [ ] status: pending

**Goal:** Update the `feature-template/` skeleton and `generate-new-genx-feature` SKILL so that
newly scaffolded features use the preview-driven detect/apply pattern (`*.preview.ts` module)
instead of the old signal-based detection.

**Why:** All existing features have been migrated to diff-as-detection via `src/lib/feature-preview/`.
New features scaffolded from the template still follow the old pattern — an immediate pattern
mismatch that must be manually corrected after scaffolding.

**What changes:**

- Add `__FOLDER_NAME__.preview.ts` to `.github/skills/generate-new-genx-feature/feature-template/`
- Update `__FOLDER_NAME__.detect.ts` template to call preview and check for emptiness
- Update `__FOLDER_NAME__.apply.ts` template to call preview and use `applyPreviewChanges()`
- Update `__FOLDER_NAME__.feature.ts` template with preview import
- Update `new-feature.ts` (scaffold script) to emit the preview file
- Update `.github/skills/generate-new-genx-feature/SKILL.md` to document the preview pattern
- Update `.github/instructions/project/feature-patterns.instructions.md` with preview conventions

**Prerequisite:** Need a stable reference feature to use as the template source. Candidates:
`oxfmt` (complex, many file mutations), `git-hooks` (medium complexity), or `vitest` (simpler).

**Status:** Not started. Blocked on choosing the reference feature.

---

## 6. `triage-docs` — cross-project portability

- [ ] status: pending

**Goal:** Make `scripts/triage-docs.ts` work as a standalone script that any `@finografic` project
can use without depending on genx's internal utilities.

**Why:** The current script imports from `utils` and `utils/picocolors` — genx-internal barrel
exports. For the `design-docs` feature (#4) to copy this script into other projects, it needs
to be self-contained.

**Options:**

- **A)** Inline the two utility dependencies (`fileExists`, `pc`) directly in the script. Simple,
  no external dep, works anywhere with `tsx` installed.
- **B)** Move the script into `@finografic/project-scripts` as a shared binary. More principled
  but adds a dependency.
- **C)** Keep it genx-internal and have the `design-docs` feature generate a simplified version
  for target projects.

**Status:** Not started. Decision needed on approach before implementing #4.

---

## Non-starters (excluded)

- **Auto-publish on version bump** — too much automation risk; manual release gates are intentional.
- **Removing `--only` from `migrate`** — `deps` command coexists as a fast path; `--only` retains
  value for other granular migrate operations (e.g. `--only=eslint`).
