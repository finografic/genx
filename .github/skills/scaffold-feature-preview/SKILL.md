---
name: scaffold-feature-preview
description: Convert an existing @finografic/genx feature to preview-driven detect/apply flow. Use when a feature still has hand-written signal detection or side-effectful apply logic and needs shared preview truth via `src/lib/feature-preview/`.
---

# Scaffold Feature Preview

Use this skill when updating an existing `src/features/*` module to the preview-driven pattern introduced for diff-as-detection.

Before making changes, read the feature's:

- `*.apply.ts`
- `*.detect.ts`
- adjacent helpers (`*.vscode.ts`, config mutators, template helpers)
- existing tests

## Goal

Make `detect()` and `apply()` consume the same canonical preview result so they cannot drift apart.

The desired shape is:

1. `previewX(context)` computes owned file changes without writing.
2. `detectX(context)` returns `!hasPreviewChanges(preview)`.
3. `applyX(context)` uses `applyPreviewChanges(preview)` plus any narrow post-write step that cannot be represented as a file change.

## Rules

- Keep generic preview infrastructure in `src/lib/feature-preview/`.
- Keep feature-specific file logic inside the feature folder.
- Do not move feature-specific rules into `src/core/`.
- Prefer clean post-run state over backup-file noise unless preserving a file is materially important.
- Keep one confirmation decision per changed file.

## Workflow

### 1. Add or update the feature-local preview

Create or update `src/features/<feature>/<feature>.preview.ts`.

The preview should:

- read the feature-owned files
- compute canonical next content
- return `FeaturePreviewResult`
- use user-facing `summary` labels
- set `needsInstall` only when a later package-manager step is actually required

### 2. Keep positioning logic local

Do not pass anchors into `detect()`.

Instead, keep placement logic in helpers such as:

- markdown section sync
- package.json script ordering
- ESLint config insertion/removal
- VS Code settings proposal helpers

The preview asks, “what would the canonical file be?”, not “where should detect insert content?”

### 3. Switch detect to preview truth

Replace signal-based detect functions with:

```ts
const preview = await previewFeature(context);
return !hasPreviewChanges(preview);
```

### 4. Switch apply to preview truth

Replace direct write orchestration with:

```ts
const preview = await previewFeature(context);
const result = await applyPreviewChanges(preview, { yesAll: context.yesAll });
```

> **Mandatory:** always pass `{ yesAll: context.yesAll }` as the second argument. This threads the
> `-y` flag from `genx audit -y` through to per-file confirmation prompts, skipping them automatically.

Only keep narrow follow-up steps outside preview when they are not representable as file changes, such as:

- `pnpm install` after an approved manifest dependency change

If you keep such a step, gate it with structured data from preview/apply, not with summary-label parsing.

### 5. Add focused migration tests

For each converted feature, add lightweight tests that prove:

- drift -> preview changes exist -> `detect()` is `false`
- canonical fixture -> no preview changes -> `detect()` is `true` where practical
- `apply()` respects preview/no-op/install behavior for the migrated flow

Prefer a few high-signal tests over broad noisy coverage.

## Checklist

- [ ] `previewX()` exists and owns canonical file output
- [ ] `detectX()` uses `previewX()` + `hasPreviewChanges`
- [ ] `applyX()` calls `applyPreviewChanges(preview, { yesAll: context.yesAll })`
- [ ] `auditX()` returns `'installed' | 'partial' | 'missing'` (partial = primary indicator present but preview has changes)
- [ ] `*.feature.ts` wires `audit: auditX`
- [ ] any post-write install step uses structured signals, not label matching
- [ ] feature-specific tests cover drift and canonical cases
- [ ] `pnpm typecheck` passes
- [ ] focused Vitest coverage passes

## Notes

- If a feature currently creates directory-only state, prefer representing it as a small owned file such as `.gitkeep` when that keeps preview/apply parity simple.
- If a feature has legacy backup behavior that users no longer value, do not over-invest in preserving it unless removing it would be destructive or surprising.
