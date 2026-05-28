# Plan: Replace `ai-claude` with `ai-memory` in `@finografic/genx`

## Goal

Refactor the existing `ai-claude` feature into a new cross-agent `ai-memory` feature.

The old feature is Claude-branded and currently manages:

- `CLAUDE.md`
- `.claude/memory.md`
- `.agents/handoff.md`
- `.claude/settings.json`
- `.claude/assets/.gitkeep`
- `.gitignore` rules for Claude / agents
- legacy `.claude/handoff.md` migration

That no longer matches the desired model.

The new model is project-level, not Claude-specific:

- `docs/process/PROJECT_MEMORY_MODEL.md`
- `docs/todo/ROADMAP.md`
- `docs/todo/NEXT_STEPS.md`
- `.agents/handoff.md`
- `.agents/memory.md`
- `AGENTS.md` gets a prominent `## Project Memory Model` section
- `CLAUDE.md` becomes only a tiny compatibility shim pointing to `AGENTS.md`
- `.claude/memory.md` becomes only a temporary compatibility pointer, if needed

Use the supplied `docs/process/PROJECT_MEMORY_MODEL.md` as the source of truth for file roles, setup rules, repair rules, ignore rules, and transitional `.claude/memory.md` pointer.

---

## Non-goals

Do not rewrite `ai-instructions` unless needed for integration.

Do not move shared instruction files out of `ai-instructions`.

Do not make `ai-memory` Claude-specific.

Do not continue treating `.claude/memory.md` as canonical.

Do not use the genx root `AGENTS.md` as the canonical template source for generated projects. For generated output, `_templates/` remains the source of truth.

---

## Desired feature boundaries

### `ai-instructions`

Keep as-is.

Owns:

- `.github/copilot-instructions.md`
- `.github/instructions/**`
- shared Copilot / Cursor / Claude instruction rules
- reverse-apply AGENTS sync behavior already implemented there, unless the existing architecture requires moving AGENTS-specific behavior into `ai-agents`

### `ai-agents`

Keep and possibly expand.

Owns:

- `AGENTS.md`
- `.github/skills/**`
- agent interface layer
- skill discovery
- project-level agent rules
- insertion / sync of the `## Project Memory Model` block in `AGENTS.md`

`ai-agents` should not necessarily create all memory files by itself.

### `ai-memory`

New replacement for `ai-claude`.

Owns:

- `docs/process/PROJECT_MEMORY_MODEL.md`
- `docs/todo/ROADMAP.md`
- `docs/todo/NEXT_STEPS.md`
- `.agents/handoff.md`
- `.agents/memory.md`
- `.gitignore` rules for `.agents/`
- migration from `.claude/memory.md` to `.agents/memory.md`
- migration from `.claude/handoff.md` to `.agents/handoff.md`
- creation/update of the simple `CLAUDE.md` pointer shim
- optional transitional `.claude/memory.md` pointer
- optional cleanup/deprecation of legacy Claude-only files

`ai-memory` should auto-install or require `ai-agents`, because the memory model requires a prominent block in `AGENTS.md`.

---

## Phase 1 — Inspect existing feature implementation

Read these current files:

```txt
src/features/ai-claude/
  ai-claude.apply.ts
  ai-claude.constants.ts
  ai-claude.detect.ts
  ai-claude.feature.ts
  ai-claude.preview.ts
  README.md

src/features/ai-agents/
  ai-agents.apply.ts
  ai-agents.constants.ts
  ai-agents.detect.ts
  ai-agents.feature.ts
  ai-agents.preview.ts
  README.md

src/features/ai-instructions/
  ai-instructions.apply.ts
  ai-instructions.constants.ts
  ai-instructions.detect.ts
  ai-instructions.feature.ts
  ai-instructions.preview.ts
  ai-instructions.agents.utils.ts
  README.md

src/features/feature-registry.ts
src/features/feature.types.ts
src/features/feature.utils.ts

src/lib/agents-gitignore.utils.ts
src/lib/agents-legacy-ai-folder.utils.ts
src/lib/gitignore-section.utils.ts
```

Also inspect:

```txt
_templates/
  AGENTS.md.template
  CLAUDE.md.template
  docs/**
  .gitignore
```

Confirm whether `PROJECT_MEMORY_MODEL.md`, `ROADMAP.md`, `NEXT_STEPS.md`, `.agents/handoff.md`, and `.agents/memory.md` already exist in `_templates/`.

---

## Phase 2 — Decide rename strategy

Prefer a real rename from `ai-claude` to `ai-memory`.

Create:

```txt
src/features/ai-memory/
  ai-memory.apply.ts
  ai-memory.constants.ts
  ai-memory.detect.ts
  ai-memory.feature.ts
  ai-memory.preview.ts
  ai-memory.preview.test.ts
  README.md
```

Use the existing `ai-claude` implementation as the starting point, but rename all symbols.

Examples:

```txt
detectAiClaude        -> detectAiMemory
applyAiClaude         -> applyAiMemory
previewAiClaude       -> previewAiMemory
AI_CLAUDE_FEATURE_ID  -> AI_MEMORY_FEATURE_ID
```

Feature ID:

```txt
ai-memory
```

Display name:

```txt
AI Memory
```

Description:

```txt
Project memory model: roadmap, next steps, handoff, session memory, and cross-agent compatibility shims.
```

Keep `ai-claude` only if needed as a deprecated alias. If kept, it should delegate to `ai-memory` and display a deprecation warning. Do not maintain two independent implementations.

---

## Phase 3 — Update feature registry

Open:

```txt
src/features/feature-registry.ts
```

Replace the registered `ai-claude` feature with `ai-memory`.

Preferred:

```txt
ai-instructions
ai-agents
ai-memory
```

Ordering should keep AI features grouped.

If backwards compatibility is needed, optionally register a deprecated alias:

```txt
ai-claude -> delegates to ai-memory
```

But avoid showing both in normal feature selection. If the feature system supports hidden/deprecated features, mark `ai-claude` hidden/deprecated. If not, remove it fully and let existing repos migrate via `ai-memory`.

---

## Phase 4 — Define canonical templates

Add or update these generated-package templates:

```txt
_templates/CLAUDE.md.template
_templates/docs/process/PROJECT_MEMORY_MODEL.md
_templates/docs/todo/ROADMAP.md
_templates/docs/todo/NEXT_STEPS.md
_templates/.agents/handoff.md
_templates/.agents/memory.md
```

If `.agents/memory.md` should be gitignored, it can still exist as a generated file during feature application, but confirm whether template copy should include it by default. For feature installation, creating it is correct.

Update `_templates/CLAUDE.md.template` to be minimal:

```md
@AGENTS.md
```

or, if plain prose is preferred:

```md
See [AGENTS.md](./AGENTS.md).
```

Use the same pattern already established across the user’s repos. Do not add Claude-specific behavior back into `CLAUDE.md`.

Add `_templates/docs/process/PROJECT_MEMORY_MODEL.md` using the supplied file content exactly or near-exactly.

Add `_templates/docs/todo/NEXT_STEPS.md` with a minimal starter shape, for example:

```md
# Next Steps

Near-term working list, manual testing, and small follow-ups.

## Active

- [ ] Review and update this list for the project.
```

Add `_templates/docs/todo/ROADMAP.md` only if missing. If there is already a roadmap template, update it to align with the memory model.

Add `_templates/.agents/handoff.md` with concise current-state placeholder text.

Add `_templates/.agents/memory.md` with maintenance rules and an empty session section.

---

## Phase 5 — Update AGENTS.md memory block handling

The new memory model requires this exact block to appear prominently in `AGENTS.md`:

```md
## Project Memory Model

- `docs/todo/ROADMAP.md` = curated milestone plan + completed milestone history.
- `docs/todo/NEXT_STEPS.md` = near-term working list, manual testing, and small follow-ups.
- `.agents/handoff.md` = current project state snapshot.
- `.agents/memory.md` = chronological working memory / session log.

Promotion rule:

- session detail, partial work, and temporary context belong in `.agents/memory.md`
- stable current truth belongs in `.agents/handoff.md`
- project priorities and completed milestone-scale work belong in `ROADMAP.md`
- small actionable follow-ups and manual verification belong in `NEXT_STEPS.md`

Do not duplicate the same item across all four files unless it truly belongs in each role.

Reference: [`docs/process/PROJECT_MEMORY_MODEL.md`](./docs/process/PROJECT_MEMORY_MODEL.md)
```

Implement this as a deterministic section insert/update.

Preferred owner: `ai-agents`.

Reason: this block is agent-facing and belongs in the root agent interface layer.

Implementation options:

1. Add the block to `_templates/AGENTS.md.template`.
2. Ensure the existing AGENTS reverse-merge logic preserves/inserts it.
3. Add/update tests so AGENTS merge is idempotent.
4. If `ai-memory` runs without `ai-agents`, make it apply `ai-agents` first or call a shared AGENTS-section helper.

Important: if both `ai-instructions` and `ai-agents` currently touch `AGENTS.md`, avoid creating competing AGENTS writers. Prefer one shared utility for inserting/updating the Project Memory Model block.

---

## Phase 6 — Implement `ai-memory` preview behavior

`ai-memory.preview.ts` should compute all owned file changes first. Detection should use preview output, matching the current preview-driven architecture.

Owned changes:

```txt
docs/process/PROJECT_MEMORY_MODEL.md
docs/todo/ROADMAP.md
docs/todo/NEXT_STEPS.md
.agents/handoff.md
.agents/memory.md
CLAUDE.md
.claude/memory.md
.gitignore
AGENTS.md memory block, directly or via ai-agents dependency
```

Preview rules:

### `docs/process/PROJECT_MEMORY_MODEL.md`

If missing:

- create from template.

If present:

- update only if clearly older or different enough.
- This document is canonical reference material, so syncing from template is acceptable.

### `docs/todo/ROADMAP.md`

If missing:

- create starter.

If present:

- do not overwrite.
- optionally add missing heading or memory-model note only if safe.
- preserve user content.

### `docs/todo/NEXT_STEPS.md`

If missing:

- create starter.

If present:

- do not overwrite.
- preserve user content.

### `.agents/handoff.md`

If missing:

- create starter.
- if legacy `.claude/handoff.md` exists, import its content under an `Imported from .claude/handoff.md` section.

If present:

- preserve content.
- optionally update top maintenance note from `.claude/memory.md` to `.agents/memory.md`.

### `.agents/memory.md`

If missing:

- create starter.
- if legacy `.claude/memory.md` exists and contains real content, migrate/import that content.

If present:

- preserve content.
- if `.claude/memory.md` contains additional non-pointer content, append/import under a clearly marked section.

### `.claude/memory.md`

If legacy file exists:

- if content was migrated to `.agents/memory.md`, replace with transitional pointer from `PROJECT_MEMORY_MODEL.md`.
- if content is already the pointer, leave as-is.

If missing:

- optional: create pointer only if `.claude/` exists or `CLAUDE.md` exists and this is useful for compatibility.
- do not treat `.claude/memory.md` as canonical.

### `.claude/handoff.md`

If legacy file exists:

- migrate/import to `.agents/handoff.md`.
- delete `.claude/handoff.md` after successful migration.

### `CLAUDE.md`

Always converge to the minimal shim.

Accepted canonical content:

```md
@AGENTS.md
```

If the project prefers link syntax, use the same style currently established in the uploaded `CLAUDE.md`.

Do not add memory rules to `CLAUDE.md`.

### `.claude/settings.json`

Question to resolve during implementation:

- If this file is still useful for Claude Code permissions, it can remain under a small compatibility concern.
- But it should no longer be the headline behavior of the feature.
- If retained, document it as “optional Claude Code settings”, not memory model.
- If removed from feature ownership, do not delete existing user settings automatically unless the old feature created them and the migration explicitly decides to clean them.

### `.claude/assets/.gitkeep`

Probably remove from new feature ownership.

Do not create new `.claude/assets/.gitkeep` for `ai-memory`.

If it already exists, leave it unless there is a safe cleanup path.

---

## Phase 7 — Implement `.gitignore` rules

The desired canonical ignore section for agents should be:

```gitignore
# Agents
.agents/*
!.agents/
!.agents/handoff.md
```

If keeping Claude compatibility:

```gitignore
# Claude
.claude/*
!.claude/
!.claude/settings.json
```

But only include Claude rules if `.claude/settings.json` remains tracked.

Important behavior:

- `.agents/handoff.md` is tracked.
- `.agents/memory.md` is gitignored.
- `.claude/memory.md` pointer is likely gitignored unless intentionally tracked.
- preserve existing unrelated `.gitignore` content.
- replace existing `# Agents` section in place.
- do not append duplicate sections.
- keep merge idempotent.

Add/update tests for `.gitignore` merge idempotency.

---

## Phase 8 — Update detect logic

`detectAiMemory()` should report installed only when the new model is present.

Installed criteria:

- `docs/process/PROJECT_MEMORY_MODEL.md` exists.
- `AGENTS.md` has `## Project Memory Model`.
- `.agents/handoff.md` exists.
- `.agents/memory.md` exists or is intentionally gitignored but created by feature.
- `.gitignore` correctly tracks `.agents/handoff.md` and ignores `.agents/memory.md`.
- `CLAUDE.md` is minimal pointer/shim.
- no canonical dependency on `.claude/memory.md`.

Partial criteria:

- legacy `.claude/memory.md` exists with real content not migrated.
- legacy `.claude/handoff.md` exists.
- old AGENTS section says “Claude Code — Session Memory and Handoff”.
- `.agents/handoff.md` exists but `.agents/memory.md` missing.
- `CLAUDE.md` contains old long instructions.
- `docs/process/PROJECT_MEMORY_MODEL.md` missing.

Missing criteria:

- none of the new memory model files exist.

---

## Phase 9 — Update apply logic

`applyAiMemory()` should:

1. build preview changes.
2. show diff per changed file.
3. apply accepted changes.
4. run dependency install only if dependencies change, which should probably not happen for this feature.
5. report clear success messages.

Expected messages:

```txt
Created project memory model files
Updated AGENTS.md Project Memory Model block
Migrated legacy Claude memory to .agents/memory.md
Migrated legacy Claude handoff to .agents/handoff.md
Updated CLAUDE.md pointer
Updated .gitignore agent rules
```

Use existing feature apply output conventions:

- `successMessage` for new files
- `successUpdatedMessage` for updates
- `successRemovedMessage` for removals

---

## Phase 10 — Update README/docs generation

Update `src/features/ai-memory/README.md`.

Suggested README summary:

```md
# ai-memory

Project memory model for agentic coding workflows.

Creates and repairs the cross-agent planning and memory structure used by @finografic projects:

- `docs/process/PROJECT_MEMORY_MODEL.md`
- `docs/todo/ROADMAP.md`
- `docs/todo/NEXT_STEPS.md`
- `.agents/handoff.md`
- `.agents/memory.md`
- `AGENTS.md` Project Memory Model block
- `.gitignore` rules for tracked handoff + ignored memory
- minimal `CLAUDE.md` pointer to `AGENTS.md`
- migration from legacy `.claude/memory.md` and `.claude/handoff.md`
```

Update generated README feature docs by running:

```bash
pnpm docs:usage
```

Do not manually edit content between generated markers in `README.md`.

The public README should no longer list `ai-claude` as the primary feature. It should list `AI Memory` / `ai-memory`.

---

## Phase 11 — Update create/migrate/audit behavior

Confirm how optional features are selected during:

```txt
genx create
genx migrate
genx features
genx audit
genx managed features
```

Make sure `ai-memory` appears in feature prompts.

Make sure `ai-claude` does not appear unless intentionally kept as a deprecated alias.

If create has default feature selections, decide whether `ai-memory` should be selected by default.

Recommended:

- `ai-instructions`: default yes for most @finografic projects.
- `ai-agents`: default yes for agent-ready projects.
- `ai-memory`: default yes for @finografic packages, because this is now core to agentic maintenance.
- `ai-claude`: no longer offered.

---

## Phase 12 — Action changes on genx itself

Because genx itself should adopt the new memory model, update the repository root too.

### Root files to update

```txt
CLAUDE.md
AGENTS.md
docs/process/PROJECT_MEMORY_MODEL.md
docs/todo/ROADMAP.md
docs/todo/NEXT_STEPS.md
.agents/handoff.md
.agents/memory.md
.gitignore
```

### Root `CLAUDE.md`

Replace with minimal pointer:

```md
@AGENTS.md
```

### Root `AGENTS.md`

Replace the old Claude-specific section:

```md
## Claude Code — Session Memory and Handoff
```

with the new:

```md
## Project Memory Model
```

Use the exact block from `PROJECT_MEMORY_MODEL.md`.

### Root `.agents/handoff.md`

Update the maintenance note from:

```txt
.claude/memory.md = session work log
.agents/handoff.md = project state snapshot
```

to the new four-file model.

Mention the new `ai-memory` feature in Status / Key Decisions.

Keep under the existing handoff length policy.

### Root `.agents/memory.md`

Create or migrate from `.claude/memory.md`.

If `.claude/memory.md` has useful recent session details, move them here.

### Root `.claude/memory.md`

Replace with transitional pointer, if keeping compatibility:

```md
# Moved

The canonical session log for this repo now lives at:

- `.agents/memory.md`

Use that file for current-session checklists and recent working memory.
`.agents/handoff.md` remains the current project-state snapshot.

This compatibility pointer is deprecated and should be removed after:

- `2026-07-31`
```

### Root `.gitignore`

Ensure:

```gitignore
# Agents
.agents/*
!.agents/
!.agents/handoff.md
```

If `.claude/settings.json` remains tracked, keep appropriate `.claude` exceptions.

---

## Phase 13 — Restructure `_templates/`

Small required restructuring:

1. Ensure `_templates/CLAUDE.md.template` exists and is minimal.
2. Add `_templates/docs/process/PROJECT_MEMORY_MODEL.md`.
3. Add/update `_templates/docs/todo/ROADMAP.md`.
4. Add `_templates/docs/todo/NEXT_STEPS.md`.
5. Add `_templates/.agents/handoff.md`.
6. Decide whether `_templates/.agents/memory.md` should exist or be created only by `ai-memory` apply.
7. Update `_templates/.gitignore` to include canonical `# Agents` section.
8. Update `_templates/AGENTS.md.template` to include the `## Project Memory Model` block.

Important:

- `_templates/` is output-only.
- Do not put feature scaffold templates there.
- Generated packages copy `_templates/` paths literally, so avoid accidental wrapper directories like `_templates/root/...`.

---

## Phase 14 — Tests

Add or update tests for:

```txt
src/features/ai-memory/ai-memory.preview.test.ts
src/features/ai-memory/ai-memory.detect.test.ts
src/lib/agents-gitignore.utils.test.ts
```

Minimum test cases:

1. Fresh repo:
   - creates memory model doc
   - creates roadmap
   - creates next steps
   - creates `.agents/handoff.md`
   - creates `.agents/memory.md`
   - creates minimal `CLAUDE.md`
   - inserts AGENTS memory block
   - patches `.gitignore`

2. Existing repo with `.claude/memory.md`:
   - migrates content into `.agents/memory.md`
   - replaces `.claude/memory.md` with pointer
   - does not duplicate content on second run

3. Existing repo with `.claude/handoff.md`:
   - imports content into `.agents/handoff.md`
   - deletes `.claude/handoff.md`
   - does not duplicate import on second run

4. Existing repo with old AGENTS Claude section:
   - replaces or supersedes old Claude-specific section
   - inserts new `## Project Memory Model`
   - idempotent on second run

5. Existing repo with populated roadmap:
   - does not overwrite user roadmap content

6. Existing repo with populated next steps:
   - does not overwrite user next steps content

7. `.gitignore`:
   - replaces existing `# Agents` section in place
   - does not append duplicates
   - idempotent

8. Feature registry:
   - `ai-memory` is listed
   - `ai-claude` is absent or deprecated/hidden

---

## Phase 15 — Manual verification commands

Run:

```bash
pnpm typecheck
pnpm test:run
pnpm lint:ci
pnpm format:check
pnpm docs:usage
pnpm build
```

Then manually test in a disposable fixture repo:

```bash
genx features ../fixture-project
genx audit ../fixture-project
genx migrate ../fixture-project
```

Verify:

- `ai-memory` appears in feature selection.
- `ai-claude` does not appear unless intentionally deprecated.
- applying `ai-memory` is idempotent.
- old Claude memory is migrated safely.
- README generated feature section is correct.

---

## Phase 16 — Cleanup

Remove or deprecate old files:

```txt
src/features/ai-claude/*
```

If fully removed:

- delete folder.
- remove imports.
- remove registry entry.
- remove stale tests.
- remove stale README references.

If deprecated alias retained:

- keep minimal wrapper only.
- no independent preview/apply logic.
- README should still promote `ai-memory`, not `ai-claude`.

Search for stale strings:

```bash
rg "ai-claude|AI Claude|Claude Code — Session Memory|\\.claude/memory|\\.claude/handoff"
```

Expected remaining references:

- migration tests
- deprecation wrapper, if retained
- transitional pointer template
- optional Claude settings handling

Everything else should use:

```txt
ai-memory
AI Memory
Project Memory Model
.agents/memory.md
.agents/handoff.md
```

---

## Acceptance criteria

The refactor is complete when:

- `ai-memory` exists as the canonical feature.
- `ai-claude` is removed or only a deprecated alias.
- README generated features list `ai-memory`, not `ai-claude`.
- `CLAUDE.md` is only a pointer to `AGENTS.md`.
- `AGENTS.md` contains the exact `## Project Memory Model` block.
- `docs/process/PROJECT_MEMORY_MODEL.md` exists in root and `_templates/`.
- `.agents/handoff.md` is tracked.
- `.agents/memory.md` is canonical session memory and gitignored.
- legacy `.claude/memory.md` content migrates to `.agents/memory.md`.
- legacy `.claude/handoff.md` content migrates to `.agents/handoff.md`.
- `_templates/` represents the new generated-package memory model.
- genx itself has been migrated to the new model.
- tests cover fresh install, legacy repair, and idempotency.
- `pnpm build`, `pnpm test:run`, `pnpm typecheck`, and generated docs pass.
