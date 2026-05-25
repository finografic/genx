# ROADMAP.md

Future enhancements identified during the deps-policy → genx → target pipeline walkthrough (2026-04-06).
Updated 2026-05-26.
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

## 7. Extract “find file section” helpers → `@finografic/cli-kit`

- [ ] status: pending

**Goal:** Promote reusable **section find/replace** helpers (starting with `.gitignore` `# Title`
blocks) from genx into **`@finografic/cli-kit`**, under an **`fs/`** or **`fs-helpers/`** namespace
(or `fs.utils.ts` / `fs.helpers.ts`—see package conventions).

**Why:** Multiple tools need the same pattern: locate `# Agents` … `# IDE`, replace in place with
template-backed canonical content, insert after `# Environment files` when missing. Genx already
implements the gitignore slice in `src/lib/gitignore-section.utils.ts` and Agents merge in
`src/lib/agents-gitignore.utils.ts` (single source: **`_templates/.gitignore`**).

**Docs:** `docs/todo/TODO.FIND_FILE_SECTION.md`.

**Status:** Genx-side behavior shipped; **port to cli-kit** + re-export for genx still pending.

---

## 8. Remove legacy ESLint from genx codebase

- [x] status: done

**Goal:** Delete all remaining ESLint detection, apply, and generation code from genx. The project
has fully migrated to `@finografic/oxc-config` (oxfmt + oxlint). ESLint references now exist only
for legacy removal/migration in target projects, but the detection constants, generator file,
VS Code types, package-type config, and `_templates/` references are dead weight.

**Why:** ~250 ESLint references remain across `src/` and `_templates/`. These add confusion, test
surface, and maintenance burden for a stack that is no longer installed or used. Every feature
that touches ESLint is already marked `// DEPRECATED`. Removing them reduces cognitive load and
makes it obvious that oxc-config is the sole path.

**What to remove:**

- `src/lib/generators/eslint-config.generator.ts` (dead file)
- `eslint` type fields in `src/types/package-type.types.ts` and `src/config/package-types.config.ts`
- ESLint constants in `src/config/constants.config.ts` (files, package names)
- `eslint.config.*` references in `src/config/rename.rules.ts`, `merge.rules.ts`
- ESLint-specific VS Code extension/settings handling in `src/types/vscode.types.ts`, `src/utils/vscode.utils.ts`
- Legacy ESLint entries in `_templates/.vscode/settings.json`, `_templates/.vscode/extensions.json`
- `_templates/.github/instructions/code/linting-code-style.instructions.md` (superseded by oxlint)
- ESLint references in `_templates/AGENTS.md.template`, `_templates/.github/copilot-instructions.md`
- `DEPRECATED` detection/removal code in oxc-config, markdown, css, git-hooks features — can be
  simplified once no target project could plausibly still have the old stack
- Update `--only=eslint` references in non-starters below

**Risk:** Low — purely subtractive. Must verify no managed target still relies on ESLint migration
paths before removing detection code.

**Status:** Not started. No dedicated TODO doc yet — scope is defined here.

**Docs:** See `// DEPRECATED` markers in affected files.

---

## 9. Toolchain version consumption from deps-policy

- [x] status: done

**Goal:** Consume the new `toolchain` export from `@finografic/deps-policy` to keep `.nvmrc`,
`engines.node`, and `packageManager` in sync across all `@finografic` packages.

**Why:** `deps-policy` now exports `toolchain.node` and `toolchain.pnpm` as bare semver strings.
These are not npm packages — they require direct file/JSON writes to `.nvmrc`, `engines.node`,
and `packageManager`. Currently these values are manually maintained per project.

**What genx needs:**

- Import `toolchain` from `@finografic/deps-policy`
- Write `.nvmrc` with `toolchain.node`
- Set `engines.node` to `>=toolchain.node` in target `package.json`
- Set `packageManager` to `pnpm@toolchain.pnpm` in target `package.json`
- Wire into both `genx deps` and `genx create` flows

**Risk:** Low — additive file writes alongside existing dependency sync.

**Status:** Policy-side complete. Genx integration not started.

**Docs:** `docs/todo/DONE_TOOLCHAIN_GENX.md`

---

## 10. Convert `--managed` flag into a `managed` command

- [ ] status: pending — **priority: do third**

**Goal:** Replace the cross-cutting `--managed` flag with `genx managed <command>` so multi-repo
execution is a first-class command rather than a flag bolted onto `migrate`, `deps`, and `features`.

**Why:** `--managed` duplicates orchestration logic (target iteration, prompts, summary) across
three commands. A dedicated `managed` command owns that loop once, and each subcommand stays
focused on single-target execution.

**What changes:**

- Add `src/commands/managed/` with target-iteration orchestration
- Route `managed migrate`, `managed deps`, `managed features` through existing single-target runners
- Keep `--managed` temporarily as a compatibility alias with a deprecation hint
- Add `managed` to root CLI help, dedicated help file, README examples
- Remove the flag once the new command is established

**Prerequisite:** Consider extracting the managed-target loop into a local generic helper first
(see `docs/todo/TODO_CLI_KIT_MANAGED_LOOP_REVIEW.md`).

**Risk:** Medium — touches CLI routing, help system, and all three command entry points.

**Status:** Not started.

**Docs:** `docs/todo/TODO_MANAGED_COMMAND.md`, `docs/todo/TODO_CLI_KIT_MANAGED_LOOP_REVIEW.md`

---

## Non-starters (excluded)

- **Auto-publish on version bump** — too much automation risk; manual release gates are intentional.
- **Removing `--only` from `migrate`** — `deps` command coexists as a fast path; `--only` retains
  value for other granular migrate operations.
