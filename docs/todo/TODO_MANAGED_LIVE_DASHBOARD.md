# TODO — `genx managed live`

A live TUI dashboard showing alignment state across selected managed targets, refreshed on an
interval. The read-only counterpart to `managed deps` / `managed status`: see which repos have
drifted without running anything against them.

Modelled on `gli live`, which already solves the same shape for PRs.

---

## Decision — this stays in genx

Considered and rejected: extracting `managed` into its own CLI.

`managed` is 965 lines, and the split does not fall where it first appears to:

| Subcommand                 | Lines | Needs genx internals?                         |
| -------------------------- | ----- | --------------------------------------------- |
| `status` + `status.commit` | 423   | No — git plus AI commit drafting              |
| `audit`                    | 250   | Yes — feature registry, apply-features runner |
| `upgrade`                  | 46    | Yes — delegates to `upgrade.cli`              |
| `deps`                     | 45    | Yes — delegates to `syncDepsForTarget`        |
| loop runner + prompt       | 114   | No                                            |

Three of the four subcommands are short loops whose entire body calls a genx command. Extracting
them would force genx to expose a programmatic API — a new public surface to version — or make
`managed` shell out to the `genx` binary and lose types, speed and error handling.

Two further reasons:

- The target list lives in genx's own config, `~/.config/finografic/genx.config.jsonc`. Two CLIs
  owning one config file is a standing coordination cost.
- The dashboard's most valuable column, **deps unaligned**, needs `dependencyRules` and
  `planDependencyChanges`, both genx-internal. `targetHasPendingChanges` already exists and is
  reusable in one line. Outside genx that column duplicates the rules or shells out.

**Revisit when** `managed` grows substantial functionality that does not need genx internals, or
when it should point at repos that are not genx-managed packages at all. Neither is true today.

Also rejected: putting it in `gli`. gli is "Git CLI, Live PR Dashboard" — PRs, Jira prefixes,
auto-rebase, its own `repos: []` config. It answers _what is happening with my branches_. This
answers _are my packages aligned_. Same TUI shape, different domain: borrow the pattern, not the home.

---

## Columns

Cost tiers matter here — see [Refresh budget](#refresh-budget).

| Column           | Source                                          | Cost          |
| ---------------- | ----------------------------------------------- | ------------- |
| version          | `package.json`                                  | cheap         |
| last commit date | `git log -1 --format=%ci`                       | cheap         |
| ahead / behind   | `git rev-list --left-right --count @{u}...HEAD` | cheap         |
| dirty files      | existing `lib/git/target-git-status.utils`      | cheap         |
| deps unaligned   | `targetHasPendingChanges` / full plan           | **expensive** |

`deps unaligned` should show a count, not a boolean — "3 packages behind" is actionable where "not
aligned" is not. That means keeping the plan, not just the predicate, so
`planTarget`/`ManifestPlan` in `deps.cli.ts` likely need exporting alongside
`targetHasPendingChanges`.

---

## Target selection

Opens with a multi-select of all managed targets, pre-checked from a remembered selection, then the
live table lists only the checked ones.

- Reuse `lib/prompts/styled-multiselect.prompt`.
- Persist the selection under XDG cache via `@finografic/core/xdg` (`getCachePath`), **not** config
  — it is a per-machine working preference, not project configuration.
- Persist by target **path or name**, never by index: the managed list is reordered and appended to,
  and an index-keyed cache silently selects the wrong repos.

The use case that motivated this: while working across three or four repos, watch only those, and
see alignment change as edits land — including edits made by an agent.

---

## Refresh budget

`managed deps` now walks every workspace manifest (see `collectWorkspaceManifests`). One repo like
LLAAB is ~12 `package.json` reads. Across 18 targets, on every tick, that is far too much I/O for a
dashboard.

gli already solved this: `DEFAULT_CACHE_MAX_AGE_SECONDS = 10` in
`src/config/defaults.constants.ts`, with `DEFAULT_LIVE_INTERVAL_SECONDS = 60`.

Do the same, split by tier:

- cheap columns refresh on the main interval
- `deps unaligned` refreshes on a longer interval, or on demand via a keypress
- show the age of the expensive column so a stale number is never mistaken for a fresh one

---

## Phases

### Phase 1 — genx, standalone (this document)

- [ ] Export `planTarget` / `ManifestPlan` from `deps.cli.ts` so counts, not just booleans, are available
- [ ] Target multi-select with XDG-cached selection, keyed by path
- [ ] Static table render of all columns, one pass, no refresh loop
- [ ] Refresh loop with per-tier intervals and visible staleness
- [ ] Actions on a focused row — at minimum: run `deps` for that target, open in editor
- [ ] `--yes` / non-TTY behaviour: render one static pass and exit, never a loop

Build it concretely. Do not abstract anything during this phase.

### Phase 2 — cli-kit extraction (only after Phase 1 ships)

Extract the primitives that Phase 1 proves generic, once a second consumer actually wants them.

Detail: [`@finografic/cli-kit` → `TODO_MANAGED_LIVE_PRIMITIVES.md`](https://github.com/finografic/cli-kit)

This supersedes nothing in [`TODO_CLI_KIT_MANAGED_LOOP_REVIEW.md`](./TODO_CLI_KIT_MANAGED_LOOP_REVIEW.md)
— that doc asks whether the **apply/skip/cancel loop** belongs in cli-kit and is still open. Phase 2
is a broader question about the **live table + selection cache**, and the two should be answered
together once both have a real second consumer.

Note for that review: the loop gained an optional `hasPendingWork` pre-check on 2026-08-30, so a
target with nothing to do is neither prompted for nor run. Any extracted API must keep that, and
must keep reporting in the caller — only the caller knows what "nothing to do" means for its flow.

### Phase 3 — gli adoption (only after Phase 2)

Detail: [`@finografic/gli` → `TODO_ADOPT_LIVE_PRIMITIVES.md`](https://github.com/finografic/gli)

---

## Open questions

- **Ahead/behind with no upstream.** Several managed repos have no remote at all — `djay-midi-config`
  is one. Decide the display: blank, `—`, or an explicit `no remote` state. It is not zero.
- **Row actions and the refresh loop.** Running `deps` for a target mutates the repo mid-refresh.
  Pause the loop while an action runs, or accept a stale row for one tick?
- **Failure isolation.** One unreadable repo must not take the dashboard down. Render the row in an
  error state and keep going.
- **Does `status` fold in?** `managed status` already reports dirty worktrees. Once `live` shows a
  dirty count, decide whether `status` stays as its own command or becomes a `live` filter.

---

## Done when

`genx managed live` opens a selection, remembers it across runs, renders the columns above for the
chosen targets, refreshes without stalling on the expensive column, and degrades to a single static
render when there is no TTY.
