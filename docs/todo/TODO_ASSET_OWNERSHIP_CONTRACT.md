# TODO - Implement the Asset Ownership Contract

> **Status:** All three phases resolved (2026-08-13). Phase 1 built and verified; Phase 2 satisfied
> by construction; Phase 3 decided and deliberately unbuilt. Remaining items are deferred by
> decision, each with the trigger that would revive it.
>
> **Primary repository:** this repo (`@finografic/genx`)
>
> **Depends on:** `@finografic/ai-agent-config` v0.1.0 — the manifest carries an `ownership` field
> per asset plus optional `exclude`.
>
> **Contract:** `@finografic-ai-agent-config/docs/reference/DISTRIBUTION_CONTRACT.md`
> **Decisions:** that package's `docs/adr/0002-content-versus-structural-ownership.md` and
> `docs/adr/0003-asset-retirement-and-removal-semantics.md`

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

### Verified through the real CLI — 2026-08-13

Manually run against a scratch consumer (the interactive `audit` multiselect needs a TTY, so this
part cannot be covered by the suite):

- consumer-authored `.agents/instructions/project/local.instructions.md` survived `audit -y`;
- `project/.gitkeep` seed created;
- `writing-skills.instructions.md` vendored with `applyTo` frontmatter;
- skills dual-written to `.agents/skills/` and `.claude/skills/`;
- second run reported both features `ok — config up to date` (idempotent);
- a hand-edited skill was reported `partial` and restored to canonical on re-apply — the drift the
  old skip-if-exists logic could never detect.

### Also fixed

- `auditAiAgents` hardcoded `detail: 'AGENTS.md out of date'` for any drift. Now that skills are
  `managed` and can drift independently, that pointed at the wrong file — observed during the CLI
  run above. The detail is now derived from the surfaces that actually changed
  (`AGENTS.md`, `skills`, or both). `auditAiInstructions` keeps its broader
  `'instructions out of date'` wording; it covers several surfaces and is not actively misleading.

## Phase 2 - Detect-only reporting for unmanaged domain documents — SATISFIED 2026-08-13

Verified rather than implemented: no feature creates, reads, or writes `CONTEXT.md`, `DESIGN.md`, or
a nested `AGENTS.md`. The ai-instructions and ai-agents features touch only the root `AGENTS.md`, and
`DESIGN.md` is handled exclusively by the `design` command, never by a sync.

- [x] Domain documents are never created or modified by a sync — true by construction, not by a
      guard that could regress. Covered indirectly: `agent-assets.utils.test.ts` asserts the
      manifest's full source list, so an asset appearing that would touch these files fails the test.
- [x] A repository with an existing glossary is never offered a competing `CONTEXT.md` — genx never
      offers `CONTEXT.md` at all.
- [x] Declining a suggested document does not leave the repository reported as broken — these
      documents are not features, so they never appear in audit status.
- [ ] **Deferred:** positively _reporting_ detected domain documents in audit output. Additive
      nicety with no defect behind it; adding audit noise for its own sake was judged not worth it.
      Revisit if a user is ever surprised that genx leaves these alone.
- [ ] **Deferred:** equivalent-artifact detection before seeding. The only `seed` asset today is
      `instructions/project/`, which has no "same role under a different name" problem. This matters
      only if genx ever seeds `CONTEXT.md`, which per ADR 0002 it does not.

## Phase 3 - Removal semantics — DECIDED 2026-08-13, deliberately unbuilt

Decision recorded in
`@finografic-ai-agent-config/docs/adr/0003-asset-retirement-and-removal-semantics.md`.

- [x] Decided: a distributor **never infers removal from absence**. Retirement is content knowledge,
      declared in the ai-agent-config manifest when it happens, and applied by genx — not inferred
      and not encoded here.
- [x] `seed` and `project-owned` files are never removed by a sync, unconditionally.
- [ ] **Unbuilt by decision:** no asset has been retired, so there is nothing to apply. Building the
      manifest field and its application now would be speculative, same reasoning as `merged`.

Why inference is unsafe, concretely: genx is its own consumer, and its `.agents/skills/` holds five
shared skills alongside five it authored itself (`generate-new-genx-feature`, `migrate-to-cli-kit`,
`scaffold-feature-preview`, `template-canonical-merge`, `triage-docs`). "Remove what is absent from
the source" would delete all five of its own.

`AI_AGENTS_REMOVED_SKILL_DIRS` and the legacy numbered-instruction-file deletion stay as **one-off
historical cleanup**, not the general mechanism — expected to shrink, never to grow.

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
