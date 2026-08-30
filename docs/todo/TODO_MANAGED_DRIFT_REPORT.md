# TODO — Scheduled managed drift report

Let something check the managed repos on a schedule and tell Justin when they have drifted, without
touching them.

Two parts: a machine-readable check in genx, and a scheduler that calls it and delivers the message.
genx owns the facts; the scheduler owns the delivery. genx learns nothing about cron, Discord or
agents.

---

## Report, never apply

The obvious version of this — run `genx managed deps --yes` nightly — is the wrong job, and there is
direct evidence.

On 2026-08-30 a routine alignment moved oxlint `1.79 → 1.80`. That single bump enabled new React
Compiler rules and broke lint in three separate repos. Fixing it meant rewriting `carousel.tsx` and
`elements/json-viewer.tsx` to drop `setState`-in-effect, and adding a missing shadcn drop-zone
override to LLAAB's `packages/ui`. Three different fixes, none mechanical.

An unattended run would have applied all of it, committed, and left four repos red.

Note the version numbers: `1.79 → 1.80` is a **minor**. Semver is not a safety signal for lint
tooling, so "auto-apply patches, report minors" is not a safe middle ground either.

The alignment is mechanical. The consequences are not. Report only.

---

## The three layers

```text
facts       genx managed deps --check --json    deterministic, genx owns it
trigger     cron, or Hermes                     transport only
judgement   a person, when something breaks     stays a person
```

Keeping these separate means the scheduler is swappable — cron today, Hermes later, CI if it ever
matters — and none of them change genx.

---

## What genx adds

A read-only mode on the existing check:

```bash
genx managed deps --check --json
```

- writes nothing, prompts for nothing, never installs
- exits `0` when everything is aligned, non-zero when something has drifted
- prints structured output on stdout, human-readable messages on stderr

Sketch, not a commitment:

```jsonc
{
  "checkedAt": "2026-08-30T12:00:00.000Z",
  "targets": [
    {
      "name": "@workspace/ui",
      "path": "/Users/justin/LLAAB",
      "drifted": [
        { "manifest": "packages/ui", "name": "oxlint", "from": "^1.79.0", "to": "^1.80.0" }
      ]
    }
  ]
}
```

Per-manifest, not per-repo: since `collectWorkspaceManifests` landed, drift lives in workspace
members far more often than at the root, and a report that only names the repo makes the reader go
hunting.

**This is nearly free once [`TODO_MANAGED_LIVE_DASHBOARD.md`](./TODO_MANAGED_LIVE_DASHBOARD.md)
ships.** `live` already gathers exactly these facts for its table; `--json` is the same data with a
different renderer. Build `live` first and this is a small addition rather than a parallel
implementation.

---

## Scheduling

Start with cron. It is one line, has no runtime of its own, and proves whether the report is worth
receiving before anything is built around it:

```cron
0 9 * * 1  cd ~/repos-finografic/@finografic-genx && genx managed deps --check --json
```

Move to Hermes when the delivery matters more than the check — when it should reach a phone rather
than a terminal that is not open. Hermes already owns that path (Discord → Mac Studio), so it is a
job definition, not new infrastructure. See LLAAB's
[`docs/integrations/hermes.md`](https://github.com/finografic/llaab) for the live config.

The boundary matches LLAAB's own adapter rule — _LLAAB owns the knowledge model, adapters own
integration with external runtimes_ — with genx in the "owns the model" seat.

---

## What the message should say

Short, and ending in something runnable:

```text
3 repos drifted — LLAAB, monorepo-demo, djay-midi-config
oxlint 1.79 → 1.80 in 5 manifests
→ genx managed deps
```

Not a diff, not a full table. Enough to decide whether to look now or later. The dashboard is where
detail belongs.

Silence when nothing has drifted. A weekly "all clear" trains you to ignore it, and the whole point
is that the message means something when it arrives.

---

## Considered and rejected — a purpose-built ADK agent

Google's [Agent Development Kit](https://adk.dev/) was considered for this and rejected. Recorded so
it does not get re-litigated.

ADK targets intelligent automation needing both reasoning and determinism — sessions, memory,
parallel jobs, failure recovery, deployment to Cloud Run / GKE / Agent Runtime. The fit fails on
scale, not on quality:

- The half that would run on a schedule is **fully deterministic**. An LLM in front of
  `genx managed deps` adds nondeterminism and per-run cost to a computation whose correct answer is
  already exactly known.
- The half that genuinely needs reasoning — diagnosing what a lint bump broke — is the half
  deliberately kept with a person, per the section above.
- It is a second AI system to version, maintain and debug alongside Hermes, for a job that is one
  cron entry and a CLI over 18 repos on one machine.

ADK and Hermes are not alternatives, either: ADK builds agents, Hermes triggers and transports them.
Choosing ADK would mean stacking both to run one command on a timer.

**Revisit when** fallout handling becomes routine and repeatable — when the task is genuinely
_"apply this known fix pattern across N repos"_ rather than three unrelated fixes as it was the first
time. At that point there is a real reasoning workload with a stable shape, and ADK 2.0's graph
workflows (deterministic paths with adaptive steps inside) are a good match. That is not today.

---

## Phases

### Phase 1 — `--json`, blocked on `managed live`

- [ ] `--check` mode: read-only, no prompts, no install, non-zero exit on drift
- [ ] `--json` output, keyed per manifest
- [ ] Cover it with a test — the schema is a contract the moment anything parses it

### Phase 2 — cron

- [ ] One scheduled invocation, output to a file or terminal
- [ ] Live with it for a few weeks before automating delivery

### Phase 3 — Hermes delivery (only if Phase 2 proves the report is wanted)

- [ ] Hermes job that runs the check and formats the message
- [ ] Silent when aligned
- [ ] Note the job in LLAAB's `docs/integrations/hermes.md`

---

## Open questions

- **Where does it run from?** The check needs every managed repo on disk, so it is Mac Studio only.
  Decide what happens when a target path is missing rather than drifted.
- **Does it fetch?** "Commits behind origin" needs a `git fetch` first, which mutates the repo's refs.
  Acceptable for a report, but it should be explicit rather than a side effect.
- **Noise from repos that are deliberately behind.** Some targets may be pinned on purpose. If that
  happens, an ignore list belongs in genx config, not in the scheduler.

---

## Done when

A scheduled run reports drift without changing anything, stays quiet when there is nothing to say,
and names the manifest rather than only the repo.
