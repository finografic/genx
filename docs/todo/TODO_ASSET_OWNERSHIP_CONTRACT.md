# TODO - Implement the Asset Ownership Contract

> **Status:** Phase 1 complete (2026-08-13). Phases 2–3 open.
>
> **Primary repository:** this repo (`@finografic/genx`)
>
> **Depends on:** `@finografic/ai-agent-config` v0.0.6+ — the manifest now carries an `ownership`
> field per asset.
>
> **Contract:** `@finografic-ai-agent-config/docs/reference/DISTRIBUTION_CONTRACT.md`
> **Decision:** `@finografic-ai-agent-config/docs/adr/0002-content-versus-structural-ownership.md`

## Outcome

`genx managed audit` honours each asset's declared ownership mode, so a sync can never destroy
consumer-authored content, and an unclassified asset stops the run instead of being guessed at.

## What changed upstream

`agentAssets` entries now carry `ownership: 'managed' | 'merged' | 'seed' | 'project-owned'` and an
optional `exclude` array on recursive entries. Four assets ship today:

| Source                    | Target(s)                            | Ownership | Note                              |
| ------------------------- | ------------------------------------ | --------- | --------------------------------- |
| `copilot-instructions.md` | `.github/copilot-instructions.md`    | `managed` |                                   |
| `instructions/`           | `.agents/instructions/`              | `managed` | recursive, excludes `project/`    |
| `instructions/project/`   | `.agents/instructions/project/`      | `seed`    | consumer-authored rules live here |
| `skills/`                 | `.agents/skills/`, `.claude/skills/` | `managed` | dual-write                        |

## Non-Goals

- Do not author policy wording here — it belongs upstream in `ai-agent-config`.
- Do not implement `merged` block reconciliation until an actual `merged` asset ships. No asset
  uses that mode today; building it now would be speculative.
- Do not change `AGENTS.md` ownership. genx `_templates` keeps it, per the contract.
- Do not run a managed multi-repository rollout as part of this work.

## Phase 1 - Honour ownership on apply — DONE 2026-08-13

- [x] Read `ownership` from the manifest wherever assets are resolved — new `src/lib/agent-assets/`
      is the single reader; `ai-instructions` and `ai-agents` no longer hardcode source paths.
- [x] Fail closed — `requireOwnership` throws `AgentAssetContractError` on a missing, unrecognised,
      or unimplemented mode, naming the valid ones. Never defaults.
- [x] `managed` — diff preview, confirm, replace.
- [x] `seed` — create when absent; report "project-owned, left untouched" when present.
- [x] `project-owned` — validated and accepted by the reader; no asset uses it yet, so no feature
      path exercises it (see Phase 2 for detect-only reporting of unmanaged domain docs).
- [x] `-y` cannot reach a `seed` file: no change is emitted for one that exists, so there is
      nothing for `yesAll` to approve. Structural, not a flag check.
- [x] Honour `exclude` via `isExcludedPath`, replacing the hardcoded `AI_INSTRUCTIONS_SKIP_SUBDIR`.

### Phase 1 acceptance

- [x] Applying twice is idempotent (`ai-instructions.ownership.test.ts`).
- [x] A consumer's file under `.agents/instructions/project/` survives byte-for-byte including with
      `-y` (same file).
- [x] An asset with a bogus ownership value aborts with an actionable message
      (`agent-assets.utils.test.ts`).

### Fixed along the way

- **Skills were behaving as `seed`, not `managed`.** `ai-agents.preview.ts` skipped any skill whose
  directory already existed, so upstream skill updates never reached a consumer that had installed
  them once. Now compared per file and replaced after preview. Skills a project authors itself are
  still never enumerated, so they survive untouched.
- **Removed duplicated content from `_templates/`.** `_templates/.agents/instructions/`,
  `_templates/.agents/skills/`, and `_templates/.claude/skills/` were stale copies of the package
  content (missing `applyTo` frontmatter and two whole files), referenced only by tests while
  production code read the package. They shipped inside genx as a second source of truth, which
  ADR 0002 forbids. Deleted; tests now seed from the installed package assets.
- **genx could not create an empty file.** The preview machinery filters a write whose content
  equals the current content, so a zero-byte `.gitkeep` seed was dropped and re-proposed every run.
  Added an optional `exists` flag on write changes plus `createFilePreviewChange`, mirroring the
  empty-file-delete handling that already existed.

### Not verified automatically

- The interactive `genx audit` path needs a TTY for its feature multiselect (`-y` only skips
  per-file confirms), so end-to-end behaviour through the real CLI is covered by the manual smoke
  test in `@finografic-ai-agent-config/docs/NEXT_STEPS.md` (item 2), not by the suite.

## Phase 2 - Detect-only reporting for unmanaged domain documents

- [ ] Treat `CONTEXT.md`, `DESIGN.md`, nested `AGENTS.md`, and equivalent domain docs as
      `project-owned` even though they are absent from the manifest: report presence, never touch.
- [ ] Before offering to create any `seed`, detect an existing equivalent under a different
      filename (e.g. a repository's own glossary) and offer a pointer or migration instead of a
      competing file.

### Phase 2 acceptance

- [ ] A repository with an existing glossary is never offered a competing `CONTEXT.md`.
- [ ] Declining a suggested document does not make the repository permanently report as broken.

## Phase 3 - Removal semantics

- [ ] Decide what happens when a file disappears from a `managed` directory upstream. Proposed:
      offer removal with a diff, never delete silently. Record the decision.
- [ ] `seed` and `project-owned` files are never removed by a sync.

## Validation

- [ ] Fixtures: a clean repo, a repo with local edits to a `managed` file, a repo with content in
      `instructions/project/`, a repo with an existing glossary under a non-standard name.
- [ ] Run preview twice; the second pass is empty.
- [ ] Focused tests for each ownership mode plus the `-y` escalation guard.
- [ ] Typecheck, lint, format on touched files.

## Suggested Commit Slices

1. `test(agent-docs): add ownership fixtures`
2. `feat(agent-docs): honour asset ownership modes`
3. `feat(agent-docs): detect-only reporting for domain documents`
4. `docs(agent-docs): record removal semantics`
