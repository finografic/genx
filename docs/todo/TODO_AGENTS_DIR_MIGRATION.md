# TODO — Migrate agent instructions/skills from `.github/` to `.agents/`

> **Status:** Planning (2026-07-25). Not started. Awaiting review — Phase 0 (drift consolidation)
> must land before Phase 1 starts.

## Why

`.github/instructions/` and `.github/skills/` (plus `.github/copilot-instructions.md`) were named
after GitHub Copilot, the first tool to standardize on this convention. Copilot isn't part of the
actual toolchain in use (Claude Code, Cursor, Codex). `.agents/` is the vendor-neutral convention
these tools are converging on, and `AGENTS.md` is already the canonical cross-tool entry point.

Two separate problems, one migration:

1. **Naming/location** — `.github/` implies Copilot ownership of content that Claude Code, Cursor,
   and Codex all consume. Renaming to `.agents/` is honest about what the content actually is.
2. **Discovery gap** — genx's 8 skills under `.github/skills/` are **not** natively discovered by
   Claude Code today. Claude Code's Skill tool only lists `.claude/skills/*/SKILL.md`. Right now
   these skills are only reachable because `AGENTS.md`'s "Skills — Check Before Implementing" table
   tells the agent to go `Read` a specific `SKILL.md` path — a manual-reference model that depends
   on the agent remembering to consult the table. Dual-writing skills to `.claude/skills/` makes
   them natively visible and self-triggering, the same way session-level skills (`dataviz`,
   `lean-ctx`) already are.

Instructions do **not** get the same dual-write — no tool in the current stack natively discovers
an "instructions" directory the way Claude Code discovers `.claude/skills/`. They stay
manually-referenced via `AGENTS.md`, just renamed and with the Copilot-only `applyTo` frontmatter
stripped (nothing in the current stack reads `applyTo` path-scoping).

## Decisions already made

- **Skills:** dual-write. Canonical source stays single-authored; it lands at both
  `.agents/skills/` (cross-tool manual reference, `AGENTS.md`-mediated) and `.claude/skills/`
  (native Claude Code discovery). Cursor's `.cursor/rules/` is untouched — separate mechanism,
  already correctly cross-references `AGENTS.md`.
- **`copilot-instructions.md`:** keep as a thin stub (one line, "see AGENTS.md"), still vendored to
  `.github/copilot-instructions.md` for any future Copilot users of scaffolded projects. Not part of
  the `.agents/` move — Copilot only reads `.github/`, so this file has to stay there to do its job.
- **Instructions filtering:** none for now. Copy all instructions unconditionally, same as today —
  no package-type-based selection. Skills may later gain package-type-aware selection (existing
  precedent: `isFrontendPackageType()` gating in `create`/`upgrade`), but that is explicitly **out
  of scope** for this migration and tracked as a future follow-up, not a blocker.
- **Sequencing:** `ai-agent-config` package → `_templates/` → genx `src/` feature code → genx root
  dogfooding copy. Confirmed by user; each phase should be reviewable independently before the next
  starts.

## Pre-existing drift discovered during scoping (informational, not required reading to start)

`_templates/.github/` (the scaffold spec) and genx root's own `.github/` (genx's dogfood copy) have
already diverged, independent of this migration:

- **Instructions:** `README.md`, `agent-facing-markdown.instructions.md`,
  `todo-done-docs.instructions.md`, `file-naming.instructions.md` differ in content between the two
  copies (not just missing files). Root also has 3 extra `project/*.instructions.md` files
  (expected — project-specific, never templated).
- **Skills:** root has 5 skills `_templates` doesn't (`generate-new-genx-feature`,
  `migrate-to-cli-kit`, `scaffold-feature-preview`, `template-canonical-merge`, `triage-docs`).
  `_templates` has 1 root doesn't (`scaffold-feature`). The 2 skills present in both
  (`scaffold-cli-help`, `scaffold-core-module`) have different `SKILL.md` content between copies.

This migration does **not** need to reconcile that drift to proceed — moving both copies to their
new `.agents/` locations preserves whatever content each currently has. Reconciling `_templates` vs
root content is a separate, pre-existing cleanup question the user should decide on independently
(see "Open questions" below).

**Update (2026-07-25):** user confirmed this drift is unintentional and the two copies should
generally be the same — `.github/` was meant to be a single source of truth. See
"Drift Detail & Consolidation Strategy" below for the full file-by-file breakdown and a proposed
merge, to review **before** Phase 1/2 starts (reconciling first means Phase 1 vendors the correct,
already-merged content into `ai-agent-config` instead of vendoring drift that then has to be
fixed twice).

`@finografic/ai-agent-config`'s `assets/` was copied verbatim from genx **root** `.github/`
(confirmed identical via `diff -rq`, modulo `.DS_Store`) — so the "did you copy the contents"
question is settled: yes, root → `assets/` is an exact copy already. The drift described above is
entirely between genx's own two internal copies (`_templates/` vs root), not between root and
`ai-agent-config`.

## Phase 0 — Drift Detail & Consolidation Strategy

User's stated intent: `.github/instructions/` (and by extension `.github/skills/`) was meant to be
**one single source of truth**. Any divergence between `_templates/.github/` and root `.github/` is
**unintentional** unless proven otherwise. Default assumption per file below: **consolidate to one
version.** Flag anything that looks like it _could_ be an intentional split for explicit sign-off
rather than silently picking a side.

### Instructions — file-by-file

#### `instructions/README.md`

```diff
- `code/`          | TypeScript patterns, oxlint style, code conventions, CLI styling           (_templates)
+ `code/`          | TypeScript patterns, ESLint/oxlint style, code conventions, CLI styling    (root)
```

Root still says "ESLint/oxlint" — leftover from before the ESLint→oxlint migration completed.
**Likely unintentional; `_templates` (oxlint-only) is correct.** → take `_templates` version.

#### `instructions/documentation/agent-facing-markdown.instructions.md`

`_templates`' examples reference `.github/skills/scaffold-feature/SKILL.md` — a skill whose
`SKILL.md` was deleted in commit `ac54b43` ("fix(ai-memory): prune legacy agent artifacts"); the
directory is empty and **not tracked by git** (confirmed via `git ls-files`). Root's copy updated
most of the same examples to reference `.github/skills/maintain-agents/SKILL.md`, but **one example
in root was missed** and still says `scaffold-feature`.

**Root's intent is right (point at a real skill), but root itself has one stale `scaffold-feature`
reference left over.** → base merge on root, then fix the remaining `scaffold-feature` mention to
point at a real skill (e.g. `maintain-agents`, matching the other examples in the same file).

#### `instructions/documentation/todo-done-docs.instructions.md`

Root **removed** the entire `NEXT_STEPS.md` convention (optional doc for medium/large projects) and
replaced it with "use `ROADMAP.md#next` instead." `_templates` still documents `NEXT_STEPS.md` as a
valid pattern.

**This is a real, deliberate policy decision** (`ROADMAP.md#next` superseding `NEXT_STEPS.md`), not
accidental drift — root is the newer, intentional version; `_templates` is stale.
→ take **root** version — this one is a genuine content update that needs to propagate forward, not
a two-way merge.

#### `instructions/naming/file-naming.instructions.md`

```diff
- Keep configs in project root (e.g., `tsdown.config.ts`, `oxlint.config.ts`, `oxfmt.config.ts`).   (_templates)
+ Keep configs in project root (e.g., `tsdown.config.ts`, `tsup.config.ts`, `eslint.config.ts`).    (root)
```

Root's example lists **tools genx doesn't use** (`tsup`, `eslint` — genx uses `tsdown` + `oxlint`
per its own `package.json` / `oxlint.config.ts`). **Root looks wrong here; `_templates` matches
genx's actual toolchain.** → take `_templates` version. Flagged rather than auto-applied since this
is illustrative example text for consumer projects that might genuinely use different tools — worth
a quick gut-check that this wasn't intentionally generic.

#### `instructions/project/*` (3 files, root-only)

`cli-help-patterns.instructions.md`, `core-module-patterns.instructions.md`,
`feature-patterns.instructions.md` — expected to be root-only per the "Rules — Project-Specific"
convention (project-specific rules are never templated, per `template-canonical-merge` skill).
**No action needed — correct as-is.**

### Skills — folder-by-folder

#### `scaffold-cli-help/SKILL.md`, `scaffold-core-module/SKILL.md` (present in both, content differs)

Root's versions are meaningfully **expanded**: restructured "Read first" into "Read first (repo)" +
"Deeper spec" sections, added an "Optional context" note about a temporary
`___REFACTORING___`-style bulk-task folder pattern, and (`scaffold-core-module` only) added a
"Related skills" cross-reference to `scaffold-cli-help`. `_templates`' versions are the older,
shorter form.

**Root reads like a genuine content improvement** (clearer structure, useful cross-reference), not
drift-by-accident. → take **root** version for both, promote into `_templates` as the new baseline.

#### `scaffold-feature/` (`_templates`-only, but dead)

Directory exists at `_templates/.github/skills/scaffold-feature/` but is **empty** — `SKILL.md` was
deleted in `ac54b43` and the directory isn't git-tracked (confirmed: `git ls-files` returns nothing
for it). Stale cruft from an incomplete rename, most likely superseded by `scaffold-feature-preview`
(root-only — matches ROADMAP P2 item #5, "modernize `generate-new-genx-feature` skill... use the
preview-driven detect/apply pattern instead of the old signal-based detection").
→ **delete the empty `_templates/.github/skills/scaffold-feature/` directory.** Not a consolidation
candidate — there's no content to merge.

#### Root-only skills: `generate-new-genx-feature`, `migrate-to-cli-kit`, `scaffold-feature-preview`, `template-canonical-merge`, `triage-docs`

These are genx-internal tooling skills (how to add a genx feature, how to migrate to cli-kit, how to
merge templates, etc.) — they describe **how to work on genx itself**, not something a scaffolded
consumer package would need. **Correctly root-only; not drift, not a candidate for `_templates`.**
No action — this is the expected shape (root has genx-dev-only skills layered on top of the
shared/templated set).

### Phase 0 checklist

- [ ] Delete dead `_templates/.github/skills/scaffold-feature/` (empty, untracked)
- [ ] `instructions/README.md` → take `_templates` version (oxlint-only wording)
- [ ] `instructions/documentation/agent-facing-markdown.instructions.md` → base on root, fix root's
      one remaining stale `scaffold-feature` reference
- [ ] `instructions/documentation/todo-done-docs.instructions.md` → take root version
      (`NEXT_STEPS.md` → `ROADMAP.md#next` supersession)
- [ ] `instructions/naming/file-naming.instructions.md` → take `_templates` version (matches actual
      toolchain) — confirm this wasn't intentionally generic example text first
- [ ] `skills/scaffold-cli-help/SKILL.md` → take root version (expanded structure)
- [ ] `skills/scaffold-core-module/SKILL.md` → take root version (expanded structure +
      cross-reference)
- [ ] Re-diff `_templates/.github/` vs root `.github/` — should show **zero** differences outside
      the expected root-only `project/*` instructions and root-only genx-dev skills
- [ ] Also remove stray `.DS_Store` files under both `.github/instructions/` and `.github/skills/`
      (found during scoping; unrelated cruft, cheap to clean up in the same pass)

Only after Phase 0 lands does Phase 1 start — `ai-agent-config` then vendors from the
now-reconciled root instead of vendoring drift that would need fixing twice. **User to confirm each
"take X version" call above before it's applied** — these are content judgment calls, not
mechanical renames.

## Phase 1 — `@finografic/ai-agent-config` package

Package: `/Users/justin/repos-finografic/@finografic-ai-agent-config`

- [ ] Reorganize `assets/`: rename `assets/instructions/` → keep name (content moves, directory
      name inside the package can stay `instructions/`, only the **manifest target** changes — the
      package's internal folder name is not itself user-facing)
- [ ] Strip `applyTo` frontmatter from any `assets/instructions/**/*.instructions.md` that has it
      (check each file — not all may use it)
- [ ] Reduce `assets/copilot-instructions.md` to a one-line stub pointing at `AGENTS.md`
- [ ] Evolve `AgentAsset.target` from `string` to `string | string[]` in `src/index.ts`
- [ ] Update `agentAssets` manifest entries:
  - `config` (copilot-instructions.md): target stays `.github/copilot-instructions.md` (Copilot-only, not part of the `.agents/` move)
  - `instruction`: target `.agents/instructions` (was `.github/instructions`)
  - `skill`: target `['.agents/skills', '.claude/skills']` (dual-write)
- [ ] Update `README.md` usage example if the manifest shape changed meaningfully
- [ ] Rebuild, verify `assetsRoot` + `agentAssets` resolve correctly (repeat the same
      `pnpm build` / `pnpm pack --dry-run` verification used when this package was first set up)
- [ ] Bump version, commit, publish (coordinate with user — this is the "pause, make a release"
      step from the original setup flow)

## Phase 2 — `_templates/`

Repo: `/Users/justin/repos-finografic/@finografic-genx`, canonical scaffold spec per
`template-canonical-merge` skill (`.github/skills/template-canonical-merge/SKILL.md`) —
`_templates/` is the only source of truth for what gets scaffolded into consumer packages.

- [ ] `git mv _templates/.github/instructions _templates/.agents/instructions`
- [ ] `git mv _templates/.github/skills _templates/.agents/skills`
- [ ] Create `_templates/.claude/skills/` (currently only `_templates/.claude/assets/` and
      `_templates/.claude/settings.json` exist) — populate from the same skill source used for
      `_templates/.agents/skills/` (single-author, two output locations, matching the
      `ai-agent-config` dual-write model)
- [ ] Strip `applyTo` frontmatter from `_templates/.agents/instructions/**/*.instructions.md`
- [ ] Reduce `_templates/.github/copilot-instructions.md` to the same one-line stub as
      `ai-agent-config` (stays under `.github/`, not moved)
- [ ] Update any relative links _inside_ the moved instruction/skill files that reference old
      `.github/...` paths
- [ ] Confirm Phase 0 already landed — `_templates/.github/` and root `.github/` should already be
      reconciled (zero drift outside expected root-only content) before this move happens

## Phase 3 — genx `src/` feature code

Update every hardcoded `.github/instructions` / `.github/skills` path found during scoping:

- [ ] `src/config/create.config.ts:37` — `aiInstructions: [...]` file list
- [ ] `src/features/ai-instructions/ai-instructions.constants.ts:7` — `AI_INSTRUCTIONS_FILES`
      (also check `detect.ts:20`, `preview.ts:135` for direct consumers)
- [ ] `src/features/ai-agents/ai-agents.constants.ts:6,9` — `AI_AGENTS_FILES`,
      `AI_AGENTS_SKILLS_DIR` (also check `ai-agents.preview.ts:135-136,161`) — this is where the
      `.claude/skills` dual-target plumbing needs to land, since no manifest/type exists yet for
      multi-target output (confirmed during scoping: genx has no `AgentAsset`-style type; these are
      untyped string constants today)
- [ ] `src/features/ai-memory/ai-memory.preview.ts:18` — reads `.github/instructions` directly (not
      via a shared constant — fix in place)
- [ ] `src/lib/agents-legacy-ai-folder.utils.ts:20` — legacy-folder detection list; decide whether
      old `.github/instructions` layout needs to be detected as "legacy" going forward (probably
      yes, symmetric with how `.claude/handoff.md` → `.agents/handoff.md` legacy migration already
      works for `ai-memory`)
- [ ] **`src/commands/upgrade/lib/agent-docs-migration.ts`** — heaviest concentration, ~30 hits
      (lines 71, 85, 148-149, 166, 294, 343, 494-524, 584-587, 632, 684-754, 789). Builds/upgrades
      the canonical instructions layout, generates README content referencing per-file instruction
      paths, and falls back to `_templates/.github/instructions` at line 689. Treat as its own
      focused sub-pass — re-scope with a fresh read of this file before editing, don't batch it in
      with the smaller constant-file changes above.
- [ ] `src/commands/upgrade/lib/upgrade-mode.prompt.ts:11` — user-facing prompt hint text
      mentioning `.github/instructions/`
- [ ] Add multi-target write support wherever skills get vendored into a consumer repo (the
      dual-write to `.agents/skills/` + `.claude/skills/` needs to happen in whatever function
      currently does the single-target copy)
- [ ] Run existing tests for `ai-instructions`, `ai-agents`, `ai-memory`, and `upgrade` features;
      add/update fixtures that assert on old `.github/...` paths

## Phase 4 — genx root (dogfooding copy)

- [ ] `git mv .github/instructions .agents/instructions`
- [ ] `git mv .github/skills .agents/skills`
- [ ] Populate `.claude/skills/` at genx root (same dual-write as Phase 2/3)
- [ ] Strip `applyTo` frontmatter, reduce `copilot-instructions.md` to stub (same as Phase 1/2)
- [ ] Update root `AGENTS.md`:
  - "Instructions to Skills Map" table (line ~42) — update paths
  - "Skills — Check Before Implementing" table (line ~164) — update paths
  - Any other inline `.github/instructions` / `.github/skills` references
  - Note: `_templates/AGENTS.md.template` does **not** contain either table (confirmed during
    scoping) — this is genx-root-only content, one edit, not two
- [ ] Update docs that hardcode these paths as documented convention (not casual mentions):
  - `docs/spec/CLI_CORE.md:5,402,403`
  - `docs/TEMPLATE_SOURCES_AND_AGENTS_MERGE.md:7,40`
  - `docs/process/PROJECT_MEMORY_MODEL.md:29,38`
  - `docs/todo/TODO_MAINTAIN_PROJECT_MEMORY_SKILL.md:9,22`
  - `docs/superpowers/plans/2026-04-07-diff-as-detection.md:49,535,585`
  - `docs/superpowers/specs/2026-04-07-diff-as-detection-design.md:238`
- [ ] Verify `genx managed audit` (or equivalent) round-trips correctly against the new layout —
      this is the actual proof the migration works end-to-end, not just that files moved

## Lifecycle: keeping genx's own copy in sync

genx has two roles with respect to `@finografic/ai-agent-config`: it **vendors** the package's
assets into every other `@finografic` project (via `create`/`upgrade`/`managed audit`), and it is
**itself a consumer** of the same package for its own root `.agents/` / `.claude/skills/` /
`AGENTS.md` content. Today that second role is hand-maintained — which is exactly how
`_templates/.github/` and root `.github/` drifted apart in the first place (Phase 0). Once Phase 3
repoints genx's vendoring logic at the published npm package, genx's own copy should stop being
hand-maintained too, for the same reason.

**Key finding:** no new machinery is needed for this. `genx upgrade` (the plain, non-`managed`
command) already runs against `process.cwd()`, and the upgrade operation picker already has an
"agent docs" category. So genx keeping its own root in sync is just genx running its own CLI against
its own repo, the same way any other `@finografic` project would — not a special self-target case.

- [ ] Add an `update:ai-agent-config` script to genx's `package.json`, following the existing
      `update:oxc-config` / `update:cli-kit` precedent (bump the npm dep) but extended with a second
      step, since unlike those packages ai-agent-config ships vendored files, not just importable
      code:
      `json
    "update:ai-agent-config": "pnpm update @finografic/ai-agent-config --latest && genx upgrade"
    `
- [ ] Check whether `upgrade` supports non-interactive operation selection (a flag to scope straight
      to "agent docs" instead of the full interactive picker) — if so, use it in the script instead
      of requiring an interactive prompt during a dependency-bump workflow
- [ ] This closes Open Question #2 below (`.claude/skills/` population strategy): generated/synced
      via this same `genx upgrade` run, not checked into `_templates/`/root as a hand-maintained
      third copy
- [ ] Once this script exists, Phase 4's "genx root" work stops being a one-time manual migration —
      run `update:ai-agent-config` instead of hand-editing root `.agents/`/`.claude/skills/` directly

## Open questions for review

1. ~~Drift reconciliation~~ — resolved above (Phase 0). Root's 5 extra genx-dev-only skills stay
   root-only by design (not templated content); the 2 shared skills + 4 instruction files get a
   one-directional merge per the file-by-file calls in Phase 0.
2. ~~`.claude/skills/` population strategy~~ — resolved above ("Lifecycle" section). Generated via
   `genx upgrade` (the same `update:ai-agent-config` script genx uses on itself), not hand-maintained
   as a checked-in third copy.
3. **Legacy `.github/` detection** — should `upgrade`/`audit` detect an existing `.github/instructions`
   layout in a _consumer_ repo and offer a migration path to `.agents/`, symmetric to how
   `ai-memory` already migrates legacy `.claude/handoff.md` → `.agents/handoff.md`? Recommend yes,
   but scope as a Phase 3 sub-item once the base path rename lands, not a blocker for it.
4. **`.github/workflows/` and other `.github/` content** — out of scope, explicitly untouched.
   Confirm no other `.github/` subdirectory (issue templates, PR templates) is implicated.

## Related

- `.github/skills/template-canonical-merge/SKILL.md` — governs how `_templates/` changes must be
  made (canonical source, no root-as-spec)
- `.agents/handoff.md`, `.agents/memory.md` — existing precedent for `.agents/`-rooted, tool-neutral
  content already in place at genx root
- `@finografic/ai-agent-config` — `docs/todo/TODO_SETUP_AGENT_CONFIG.md` (in that repo) — original
  setup plan this migration builds on
