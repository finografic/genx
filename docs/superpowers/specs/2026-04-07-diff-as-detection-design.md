# Diff-as-Detection Design

**Date:** 2026-04-07

**Status:** Approved for planning

**Roadmap item:** `docs/todo/TODO.ROADMAP.md` → `## 3. Diff-as-detection`

## Goal

Replace hand-written feature `detect()` signal checks with a generate-and-diff workflow:

1. Read the current project state for the files a feature owns.
2. Compute the canonical next content for those files without writing anything.
3. Diff current vs proposed content.
4. Treat an empty diff set as "feature already applied".

This makes detection exact relative to feature output instead of approximate relative to a few hand-picked signals.

## Non-Goals

- Do not build a generic mutation DSL in this phase.
- Do not redesign `src/core/file-diff/` in this phase.
- Do not introduce per-hunk confirmation prompts.
- Do not require callers to pass anchors, keywords, or placement hints into `detect()`.
- Do not promote new internals into `src/core/` until the pattern is proven across features.

## Decision Summary

### Chosen approach

Adopt a shared **preview/change-set** layer per feature.

- `detect()` becomes: compute preview -> inspect change set -> return `true` when no owned file would change.
- `apply()` becomes: compute preview -> write changed files -> report applied items.
- The same canonical file transformation logic is used by both paths.

### Rejected approach

Do not add a "dry-run wrapper" around the current write-heavy `apply()` implementations.

That would require intercepting writes, copies, renames, deletes, prompts, and directory creation. It is more magical, less testable, and still leaves detection dependent on side-effectful code paths.

## Key Principles

### 1. Keep the external feature contract stable

The top-level feature pattern remains familiar:

- `detect(context)` stays optional and side-effect-free.
- `apply(context)` still returns `FeatureApplyResult`.
- `FeatureContext` remains simple and should not gain anchor or placement configuration.

The architectural change happens inside feature internals, not at the command-call site.

### 2. Positioning belongs to file mutators, not to detection inputs

`detect()` should not receive instructions like:

- "insert after constant X"
- "insert before section Y"
- "find code block Z"

Those rules belong inside file-specific mutators that already know how to produce canonical output for:

- `package.json`
- structured markdown files like `AGENTS.md`
- config source files like `eslint.config.ts`
- VS Code settings and extension recommendations

Detection only asks: "if this feature ran canonically, what would the resulting files be?"

### 3. One user decision per file

For user-facing writes:

- zero diff -> no prompt
- non-empty diff -> one prompt for that file
- never prompt per diff hunk or per inserted block

This matches the existing `core/file-diff` UX and keeps review predictable.

### 4. Keep feature-specific logic out of `src/core/` for now

The first implementation should live in application code, likely under `src/lib/` plus feature-local preview helpers.

Reason:

- the change-set architecture is still being validated
- much of the logic is repo-specific
- `src/core/` is shared across multiple CLI repos and should only absorb stable, portable primitives

If the pattern proves useful across multiple CLI repos, a later follow-up can promote a small stable subset into `CLI_CORE.md`.

## Proposed Architecture

### A. Change-set model

Introduce a small internal representation for previewed file changes.

Suggested shape:

```ts
interface ProposedFileChange {
  path: string;
  currentContent: string;
  proposedContent: string;
  changed: boolean;
  summary?: string;
}

interface FeaturePreviewResult {
  changes: ProposedFileChange[];
  applied: string[];
  noopMessage?: string;
}
```

Rules:

- Each entry represents a whole-file current/proposed comparison.
- `changed` is derived from string comparison, not stored independently by callers.
- `applied` remains user-facing summary text for `apply()`.
- Preview never writes to disk.

### B. Feature preview function

Each feature should gain an internal preview function, for example:

```ts
async function previewOxfmt(context: FeatureContext): Promise<FeaturePreviewResult>;
```

That function:

1. Reads relevant files.
2. Computes canonical next content using file mutators.
3. Returns file change objects plus user-facing summary labels.

Then:

- `detectX()` calls `previewX()` and returns `changes.every((c) => !c.changed)`.
- `applyX()` calls `previewX()`, confirms changed files, writes approved changes, and returns the corresponding `FeatureApplyResult`.

### C. File mutators remain domain-specific

Do not attempt to unify all mutations under a single abstraction.

Instead, keep or extract focused helpers such as:

- `ensureMarkdownLintBlock(content) -> nextContent`
- `ensureGitHooksPackageJson(packageJson) -> nextPackageJson`
- `syncAiAgentsSections(content, templateContent) -> nextContent`
- `ensureOxfmtScriptsOrder(packageJson) -> nextPackageJson`

These helpers are the real canonical source of truth.

The preview layer orchestrates them; it does not replace them.

### D. Detection semantics

Detection becomes exact for the files the feature owns.

`detect()` returns:

- `true` when preview produces no changed files
- `false` when at least one owned file would change

This intentionally replaces lightweight "signal present" checks with "canonical output already matches" checks.

### E. Apply semantics

`apply()` should:

1. Run preview.
2. Filter to changed files.
3. For each changed file, call the existing diff confirmation flow.
4. Write approved files.
5. Return applied summaries only for changes actually written.

Important:

- If preview yields no changed files, return the existing no-op shape.
- If a user skips every changed file, the result should still be a no-op.
- Prompting remains one decision per changed file.

### F. Skills for repeatable patterns

If the preview/change-set pattern stabilizes, add a repo skill for future feature work.

Candidate scope for a future skill:

- scaffold a feature-local `preview` helper
- wire `detect()` to preview emptiness
- wire `apply()` to preview + per-file confirmation
- keep file mutators pure and reusable

This should happen after the implementation proves the pattern across multiple existing features.

## Migration Strategy

Implement incrementally, not as a big-bang rewrite.

### Phase 1: internal preview primitives

- Add internal change-set types and helper utilities outside `src/core/`.
- Keep them small and focused on whole-file comparisons.

### Phase 2: convert a representative feature

Start with one feature that exercises non-trivial mutation logic and previously showed detect drift.

Recommended first candidate: `oxfmt`

Reason:

- it is the canonical false-detection example from the roadmap
- it touches `package.json`, config files, and ordering logic
- it proves whether the architecture handles real-world complexity

### Phase 3: convert the remaining features

Migrate feature-by-feature, extracting reusable file mutators only when duplication is real.

Suggested rough order:

1. `oxfmt`
2. `git-hooks`
3. `markdown`
4. `ai-agents`
5. remaining simpler features

### Phase 4: optional promotion and skilling

After multiple features use the same preview/change-set pattern:

- decide whether any small utility belongs in `src/core/`
- decide whether a new `.github/skills/` skill should scaffold the pattern

## Testing Strategy

Focus tests on the new truth boundary: preview output.

### Preview tests

For each converted feature:

- when files are already canonical, preview returns no changed files
- when one required piece is missing, preview returns the expected changed files
- proposed content is canonical and idempotent

### Detect tests

- `detect()` returns `true` for already-canonical fixtures
- `detect()` returns `false` when preview reports any changed file

### Apply tests

- `apply()` writes only changed files
- skipping a diff leaves files unchanged
- rerunning after apply produces a no-op

### Regression target

Add explicit coverage for the roadmap example where a feature used to pass signal checks but still had missing canonical output.

## Risks

### 1. Hidden side effects inside existing apply code

Some current feature helpers write directly to disk. Those responsibilities must move behind pure content transformers before preview can reuse them safely.

### 2. Over-abstraction

Trying to invent a universal AST or anchor DSL too early will slow delivery and raise maintenance cost.

### 3. Partial ownership ambiguity

Each feature must define which files it owns for detection purposes. Detection should only compare files the feature is responsible for producing or mutating canonically.

## Open Decisions

These are intentionally narrow and should be resolved during planning:

1. Exact file/type location for the new preview/change-set utilities outside `src/core/`
2. Whether preview summaries should list every changed file or preserve higher-level labels from current `applied[]`
3. Whether some simple features can remain signal-based temporarily during migration
4. Whether a new repo skill should be created in the same implementation pass or in a short follow-up pass

## Recommendation

Proceed with an incremental implementation centered on:

- feature-local preview functions
- whole-file change sets
- diff emptiness as detection truth
- existing `core/file-diff` as the apply-time confirmation UX

This delivers the architectural goal of roadmap item #3 without destabilizing shared `src/core/` modules or over-designing a generic mutation system.
