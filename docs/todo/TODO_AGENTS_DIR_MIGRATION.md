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
- **Content flows outward from `ai-agent-config`, not into it (2026-07-26 update).** Originally
  Phase 0 reconciled `_templates` vs root drift _inside genx_, and Phase 1 then vendored the
  reconciled result into `ai-agent-config`. That was backwards — `ai-agent-config` is the permanent
  single source of truth, so it should receive the consolidation fixes directly. `_templates/` and
  genx root then both pull _from_ `ai-agent-config` (manually for the initial migration, via
  `update:ai-agent-config` / `genx upgrade` afterward — see "Lifecycle" below) rather than genx
  reconciling with itself first.
- **Skill distribution scope (2026-07-26 update).** Of genx root's 5 genx-dev-only skills, only
  `triage-docs` is a candidate for eventual distribution via `ai-agent-config` — and only once
  `scripts/triage-docs.ts` is portable (ROADMAP P2 item #6; currently blocked). The other four
  (`generate-new-genx-feature`, `migrate-to-cli-kit`, `scaffold-feature-preview`,
  `template-canonical-merge`) stay genx-root-only permanently — confirmed by user, overriding an
  earlier draft of this plan that suggested moving `migrate-to-cli-kit` over now.

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
"Phase 0 — Drift Detail & Consolidation Strategy" below for the full file-by-file breakdown.

`@finografic/ai-agent-config`'s `assets/` was copied verbatim from genx **root** `.github/`
(confirmed identical via `diff -rq`, modulo `.DS_Store`) — so the "did you copy the contents"
question is settled: yes, root → `assets/` is an exact copy already, including the bugs described
below. That's exactly why Phase 0 (2026-07-26 update above) now fixes content **directly in
`ai-agent-config/assets/`** rather than in genx root first — root's copy is not assumed correct by
default, `ai-agent-config` is the thing being fixed.

## Phase 0 — Drift Detail & Consolidation Strategy

User's stated intent: `.github/instructions/` (and by extension `.github/skills/`) was meant to be
**one single source of truth**. Any divergence between `_templates/.github/` and root `.github/` is
**unintentional** unless proven otherwise. Default assumption per file below: **consolidate to one
version.** Flag anything that looks like it _could_ be an intentional split for explicit sign-off
rather than silently picking a side.

**Where the fix lands:** directly in `@finografic-ai-agent-config/assets/` (currently an exact copy
of genx root, per the "did you copy the contents" confirmation above). `_templates/` and genx root
are **not** edited independently — they pick up these fixes in Phase 2 / Phase 4 by pulling from the
now-corrected `ai-agent-config` assets, not by resolving the same diffs a second time.

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
point at `maintain-agents`, matching the other examples in the same file.

**Context (2026-07-26):** `scaffold-feature` wasn't a typo or a placeholder — it used to be a real
skill name. It was renamed to `generate-new-genx-feature` at some point (that folder's `SKILL.md`
frontmatter still says `name: scaffold-feature`, a leftover — see the cli-kit finding below), and
the old references in this instructions file were never fully updated. `generate-new-genx-feature`
is **not** a valid example here even though it's the "real" successor skill: it's genx-only and
won't exist in projects this file gets distributed to. `maintain-agents` is correct specifically
_because_ it's one of the few skills that actually ships via `ai-agent-config` to every consumer.

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

#### Root-only skills — per-skill distribution call (2026-07-26)

Checked each of the 5 root-only skills against actual content, not just the folder name:

| Skill                       | What it actually does                                                                                                                                                                                                                               | Distribution                                                                                                                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `generate-new-genx-feature` | Scaffolds `src/features/*` in genx itself (`pnpm dev:feature`)                                                                                                                                                                                      | **genx-only, permanent**                                                                                                                                                                             |
| `scaffold-feature-preview`  | Converts genx's own `src/features/*` to the preview/detect/apply pattern                                                                                                                                                                            | **genx-only, permanent**                                                                                                                                                                             |
| `template-canonical-merge`  | Governs genx's own `_templates/` merge rules                                                                                                                                                                                                        | **genx-only, permanent**                                                                                                                                                                             |
| `migrate-to-cli-kit`        | Generic — "Use when **a CLI project** still carries its own `src/core/flow/`..." — no genx-specific content                                                                                                                                         | **genx-only, by user decision** — not distributed to `ai-agent-config` even though the content itself is generic. User's call: this isn't something target projects need pushed to them proactively. |
| `triage-docs`               | Generic in concept (organize planning docs into `docs/specs`/`docs/scratch`), but its preferred path calls `pnpm triage:docs` → `scripts/triage-docs.ts`, which only exists in genx (ROADMAP P2 #6, "cross-project portability," currently blocked) | **genx-only for now — the one skill flagged as useful for target projects.** Move to `ai-agent-config` once #6 ships portability, not before.                                                        |

No action needed on any of these for this migration — they all correctly stay under genx root's
`.agents/skills/` in Phase 4, none of them go into `ai-agent-config/assets/skills/` in Phase 0.
`triage-docs` gets a tracking note (see "Related" at the end) rather than a phase task, since it's
blocked on separate work.

#### Stale duplicate found in a different repo: `@finografic-cli-kit/.github/skills/scaffold-feature/SKILL.md`

Not part of the `_templates` vs root diff (different repo entirely), but surfaced while resolving
the dead `scaffold-feature` reference above. Diffed it against genx's
`generate-new-genx-feature/SKILL.md` — **same skill, cli-kit's copy is a stale duplicate.** Genx's
version is meaningfully newer (tri-state `audit()`, preview-driven `apply()`, mandatory `yesAll`
handling — none of which exist in cli-kit's copy). It has no reason to live in cli-kit — cli-kit is
a shared library, not something that scaffolds genx features — and was likely copy-pasted there
before genx renamed the folder from `scaffold-feature` to `generate-new-genx-feature`, then never
removed.

→ **Delete** `@finografic-cli-kit/.github/skills/scaffold-feature/` entirely (not rename — it
doesn't belong in that repo at all; genx already has the current version). Tracked as its own action
item since it's a separate repo, outside the Phase 0–4 sequence.

#### Related cleanup: `generate-new-genx-feature/SKILL.md` frontmatter

While comparing the two copies: genx's `generate-new-genx-feature/SKILL.md` still has
`name: scaffold-feature` in its own frontmatter — mismatched against its folder name, a leftover
from the same rename. → fix `name:` to `generate-new-genx-feature` for consistency. Small, unrelated
to the `.agents/` migration itself, but cheap to fix in the same pass since it was found here.

### Phase 0 checklist

All edits below apply to `@finografic-ai-agent-config/assets/` directly (currently an exact copy of
genx root, so in practice this means: start from what's already in `assets/`, apply each fix).

- [ ] `assets/instructions/README.md` → apply `_templates` wording (oxlint-only, drop "ESLint/")
- [ ] `assets/instructions/documentation/agent-facing-markdown.instructions.md` → fix the one stale
      `scaffold-feature` reference to `maintain-agents` (see historical context note above)
- [ ] `assets/instructions/documentation/todo-done-docs.instructions.md` → apply root's version
      (`NEXT_STEPS.md` → `ROADMAP.md#next` supersession — this is already the content in `assets/`
      since it was copied from root, so **no change needed** here, just confirming it's correct)
- [ ] `assets/instructions/naming/file-naming.instructions.md` → apply `_templates` wording
      (`tsdown`/`oxlint` example, not `tsup`/`eslint`) — confirmed by user: eslint and tsup are both
      deprecated in favor of oxc-config tooling, so this is settled, not just a gut-check
- [ ] `assets/skills/scaffold-cli-help/SKILL.md` → already root's (expanded) version since `assets/`
      mirrors root — confirm no further change needed
- [ ] `assets/skills/scaffold-core-module/SKILL.md` → same as above, confirm no further change needed
- [ ] Remove stray `.DS_Store` if present under `assets/` (should already be excluded per the
      original vendoring pass, but re-verify)
- [ ] Strip `applyTo` frontmatter from any `assets/instructions/**/*.instructions.md` that has it
      (check each file — not all may use it; Copilot-only mechanism, nothing else reads it)
- [ ] Reduce `assets/copilot-instructions.md` to a one-line stub pointing at `AGENTS.md`
- [ ] **Separate repo action:** delete `@finografic-cli-kit/.github/skills/scaffold-feature/`
      entirely (stale duplicate, see above)
- [ ] **Separate repo action:** fix `name: scaffold-feature` → `name: generate-new-genx-feature` in
      genx root's `.github/skills/generate-new-genx-feature/SKILL.md` frontmatter
- [ ] Rebuild `ai-agent-config` (`pnpm build`), re-verify `assetsRoot`/`agentAssets` resolve, same
      verification used when the package was first set up

`_templates/.github/skills/scaffold-feature/` (the empty, untracked, dead directory) gets deleted in
Phase 2 when genx renames `_templates/.github/` → `_templates/.agents/`, since it has no content to
carry forward either way.

Only after Phase 0 lands does Phase 1 start. **User to confirm each "take X version" call above
before it's applied** — these are content judgment calls, not mechanical renames. (The
`file-naming.instructions.md` and `todo-done-docs.instructions.md` calls are now confirmed per
user's 2026-07-26 message — eslint/tsup deprecated, `NEXT_STEPS.md` deprecated — so those two no
longer need separate sign-off.)

## Phase 1 — `@finografic/ai-agent-config` manifest/plumbing

Package: `/Users/justin/repos-finografic/@finografic-ai-agent-config`. Content is already correct
after Phase 0 — this phase is purely the manifest/type/target changes, no more content decisions.

- [ ] Note: `assets/instructions/` and `assets/skills/` folder names inside the package stay as-is
      (not user-facing) — only the **manifest `target` fields** change, handled below
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

**Content source note:** don't `git mv` and assume the existing `_templates/.github/instructions` /
`_templates/.github/skills` content is correct — it's the side that was identified as _stale_ in
several of the Phase 0 file-by-file calls (e.g. `todo-done-docs.instructions.md`,
`scaffold-cli-help/SKILL.md`). Replace contents with what's now in the corrected
`@finografic-ai-agent-config/assets/` (post-Phase-0), then delete the old `.github/` copies — don't
carry forward pre-consolidation content under a renamed path.

- [ ] Copy `_templates/.agents/instructions/` and `_templates/.agents/skills/` from the corrected
      `ai-agent-config/assets/instructions/` and `assets/skills/` (already `applyTo`-stripped,
      already has the copilot-instructions.md stub applied from Phase 0)
- [ ] Delete `_templates/.github/instructions/` and `_templates/.github/skills/` (including the
      empty, untracked, dead `_templates/.github/skills/scaffold-feature/` directory)
- [ ] Create `_templates/.claude/skills/` (currently only `_templates/.claude/assets/` and
      `_templates/.claude/settings.json` exist) — same content as `_templates/.agents/skills/`
      (single-author, two output locations, matching the `ai-agent-config` dual-write model)
- [ ] `_templates/.github/copilot-instructions.md` stays under `.github/` (not moved) — already a
      one-line stub if Phase 0's `ai-agent-config` fix is copied over
- [ ] Update any relative links _inside_ the moved instruction/skill files that reference old
      `.github/...` paths
- [ ] Re-diff `_templates/.agents/` against `ai-agent-config/assets/` — should be **identical**
      (this is now a straight copy, not an independent reconciliation)

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

Same content-source caveat as Phase 2: root's current `.github/instructions` / `.github/skills` has
several stale files per Phase 0 (e.g. the "ESLint/oxlint" wording, the `tsup`/`eslint` example) —
don't `git mv` it as-is. Ideally this phase is just running `update:ai-agent-config` (see
"Lifecycle" below) once that script + Phase 3's code changes exist, since that's the whole point of
building it — but documenting the manual steps here in case the script isn't ready yet when this
phase starts:

- [ ] Move instructions/skills content: same shared content as `_templates/.agents/` (from
      `ai-agent-config/assets/`) **plus** root's 5 genx-only skills carried forward unchanged
      (`generate-new-genx-feature` — with the `name:` frontmatter fix from Phase 0 — plus
      `migrate-to-cli-kit`, `scaffold-feature-preview`, `template-canonical-merge`, `triage-docs`)
- [ ] `.agents/instructions/` ends up identical to `_templates/.agents/instructions/` (no root-only
      instructions expected beyond the existing `project/*` files, which stay root-only as before)
- [ ] `.agents/skills/` = `_templates/.agents/skills/` (the 2 shared skills) + the 5 genx-only skills
      above
- [ ] Populate `.claude/skills/` at genx root (same dual-write as Phase 2/3) — shared skills +
      genx-only skills, since genx wants native Claude Code discovery for its own dev skills too
- [ ] Delete old `.github/instructions/`, `.github/skills/` once the above is verified
- [ ] `copilot-instructions.md` stays a stub under `.github/` (same as Phase 1/2)
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

1. ~~Drift reconciliation~~ — resolved above (Phase 0). Root's 5 genx-dev-only skills stay root-only
   (4 permanently, `triage-docs` pending ROADMAP #6); the 2 shared skills + 4 instruction files get a
   one-directional merge, applied directly in `ai-agent-config/assets/`, per the file-by-file calls
   in Phase 0.
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
- **`triage-docs` → future `ai-agent-config` candidate.** The one skill user flagged as useful for
  target projects, but blocked on ROADMAP P2 item #6 (`scripts/triage-docs.ts` portability) before it
  can move out of genx-only. Revisit once #6 ships — not part of this migration's phases.
- **cli-kit cleanup (separate repo, tracked here for visibility only):** delete the stale
  `@finografic-cli-kit/.github/skills/scaffold-feature/` duplicate (found during Phase 0). Not a
  genx or `ai-agent-config` change — do it directly in the cli-kit repo whenever convenient.
- `@finografic/ai-agent-config` — `docs/todo/TODO_SETUP_AGENT_CONFIG.md` (in that repo) — original
  setup plan this migration builds on
