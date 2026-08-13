# TODO - Implement the Asset Ownership Contract

> **Status:** Not started. Contract accepted upstream 2026-08-13.
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

## Phase 1 - Honour ownership on apply

- [ ] Read `ownership` from the manifest wherever assets are resolved.
- [ ] Fail closed: an asset without a valid mode aborts that asset with a clear message, and the
      run reports it rather than skipping silently.
- [ ] `managed` — current behaviour: diff preview, confirm, replace.
- [ ] `seed` — create when absent; when present, skip without diffing and report "project-owned,
      left untouched".
- [ ] `project-owned` — never create, never write; detect and report only.
- [ ] `-y` may skip confirmation for `managed` only. Assert it cannot create or overwrite `seed`.
- [ ] Honour `exclude` so `instructions/project/` is not swept up by the recursive
      `instructions/` entry.

### Phase 1 acceptance

- [ ] Applying twice is idempotent.
- [ ] A consumer's file under `.agents/instructions/project/` survives a sync byte-for-byte,
      including with `-y`.
- [ ] An asset with a bogus ownership value aborts with an actionable message.

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
