# Skill Distribution Model

**Date:** 2026-08-23
**Status:** Draft
**Roadmap:** [`ROADMAP.md`](../todo/ROADMAP.md) #12

## Goal

Stop distributing skills through genx's asset pipeline, and adopt the Agent Skills CLI
(`npx skills`) as the transport for every skill that leaves this repository.

genx currently dual-writes each shared skill as two real directories, `.agents/skills/<name>/` and
`.claude/skills/<name>/`, from `@finografic/ai-agent-config`'s `managed` asset manifest. Two real
copies of identical content is a bug generator: it produced a CI failure on 2026-08-23 when md-lint
classified one path as an agent doc and the other as standard, and it makes every consuming tool
responsible for knowing the two are the same file.

The ecosystem has already solved this. `installSkillForAgent` writes **one canonical copy and
symlinks each agent directory at it**, falling back to a real copy only where an agent rejects
symlinks. Verified against `finografic/ai-skills` on 2026-08-23: one command installed to nine
agents, with `.claude/skills/<name>` a symlink into `.agents/skills/<name>`.

## Non-Goals

- **Replacing `@finografic/ai-agent-config`.** It keeps instructions, the Copilot pointer, and the
  asset manifest. It loses only its skills.
- **Changing what any skill says.** This spec moves skills; it does not edit them.
- **Adopting `npx skills` for instructions.** The CLI handles skills only.
- **Publishing genx-dev-only skills.** Those stay local, per Key Decision 12.

## Decision Summary

| #   | Decision                                                                                                                        | State       |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1   | Skills are distributed by `npx skills add finografic/ai-skills`, never vendored by genx.                                        | **Adopted** |
| 2   | `finografic/ai-skills` is public, MIT, and carries `skills/` as its only discovery container.                                   | **Adopted** |
| 3   | Every skill layout — shared, third-party, and genx-local — is canonical copy plus symlinks, never two real copies.              | Proposed    |
| 4   | **`skills-lock.json` is the migration gate.** Its presence means an external manager owns skills, and genx must not write them. | **Adopted** |
| 5   | genx **invokes** the CLI, pinned and non-fatal, rather than only reporting. It offers; it never runs silently.                  | **Adopted** |
| 6   | Dual-write stays, gated on the lockfile's _absence_, until every managed repo has migrated. It is then dead code and deletes.   | **Adopted** |
| 7   | ai-agent-config's skill asset later moves to an `external` ownership mode rather than being deleted from the manifest.          | Proposed    |
| 8   | genx must understand `external` before ai-agent-config emits it — fail-closed makes the reverse order an error.                 | **Adopted** |
| 9   | `skills-lock.json` is **committed**. It is the migration gate, so an untracked lockfile un-migrates the repo on every clone.    | **Adopted** |
| 10  | Migration commits the directory removal and the symlink **separately** — one staged type change breaks `git stash`.             | **Adopted** |

## Architecture

### Three categories of skill

| Category          | Examples                                                                                                  | Home                             | Transport           |
| ----------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------- |
| **genx-dev-only** | `generate-new-genx-feature`, `migrate-to-cli-kit`, `scaffold-feature-preview`, `template-canonical-merge` | genx `.agents/skills/`           | None — never leaves |
| **Shared**        | `maintain-agents`, `apply-design-md`, `generate-design-md`, `scaffold-cli-help`, `scaffold-core-module`   | `finografic/ai-skills` `skills/` | `npx skills add`    |
| **Third-party**   | `design-taste-frontend`                                                                                   | Upstream repository              | `npx skills add`    |

Only the middle row changes. The first stays exactly where it is; the third already works.

### Discovery containers are load-bearing

The CLI treats `skills/`, `.agents/skills/`, `.claude/skills/`, and ~60 other agent directories as
discovery containers. A repository that keeps a skill in two containers publishes it twice under one
frontmatter name.

This is why `ai-skills` has no agent directories, and why ai-agent-config could not have served as
the source unmodified: it carries three real copies of every skill, in `.agents/skills/`,
`.claude/skills/`, and `assets/skills/`, two of which are containers.

### Install identity comes from frontmatter

`name:` in the `SKILL.md`, never the directory name. Renaming a directory is free; renaming `name:`
breaks every consumer's `skills-lock.json` entry.

### Drift detection is built in

`skills-lock.json` records a `computedHash` per installed skill. This is the guard that Key Decision
17 keeps asking for, except supplied by the transport rather than hand-rolled per surface. It is a
**pull**: publishing a change does not reach a consumer until someone runs `skills update`.

## Three hazards

### 1. Two managers, one path — live today

genx declares `AI_AGENTS_SKILLS_TARGET_DIRS = ['.agents/skills', '.claude/skills']` and dual-writes
the five manifest skills into both as real directories. The CLI puts a **symlink** at
`.claude/skills/<name>`. So installing any of those five into a managed repository today means
genx's next `upgrade` either replaces the symlink with a real directory or writes straight through
it into the canonical copy. Either way `computedHash` in `skills-lock.json` stops matching and the
CLI reports drift it did not cause.

Third-party skills are unaffected: `design-taste-frontend` is absent from the manifest, so genx
never touches it. The exposure is exactly the five shared skills.

**Resolution: gate on `skills-lock.json`.** Its presence is proof that an external manager owns
skills in this repository.

| Lockfile | genx behaviour                                                              |
| -------- | --------------------------------------------------------------------------- |
| Absent   | Dual-write as today — the repository has not migrated — and offer migration |
| Present  | Never write skills; report state and offer `update` when hashes drift       |

This makes migration **per-repository and unordered** rather than a flag day, and it is
self-retiring: once every managed repository has a lockfile, the dual-write branch is unreachable
and deletes cleanly. Until then it is a live path and keeps its tests.

It also closes the freeze that a hard cutover would cause. A repository that has not migrated keeps
receiving skill updates exactly as before, instead of silently stopping.

### 2. Removing the manifest entry offers deletion

ai-agent-config declares skills as a `managed` asset:

```ts
{ kind: 'skill', source: 'skills', target: ['.agents/skills', '.claude/skills'], ownership: 'managed' }
```

Per the distribution contract's lifecycle table, a `managed` asset **removed from the manifest**
means _"offer removal"_. So simply deleting this entry makes genx offer to delete
`.agents/skills/` and `.claude/skills/` in every managed repository — when the intent is that the
skills stay exactly where they are, under a different manager.

**Resolution: a new `external` ownership mode.** The asset stays declared, so genx knows the paths
exist and who owns them, but:

| Mode       | Create when absent | Update when present | Conflict    | Removed from manifest |
| ---------- | ------------------ | ------------------- | ----------- | --------------------- |
| `external` | Never              | Never               | Report only | Leave in place        |

The difference from `project-owned` is intent, and it is worth the extra mode: `project-owned` means
_the consuming repository authored this_, while `external` means _another tool manages this, and
here is which one_. That lets genx report something useful — "skills are managed by `npx skills`;
`skills-lock.json` shows 2 of 5 behind" — rather than staying silent.

### Ordering constraint

Rule 1 of the distribution contract is **fail closed**: an asset with no recognised `ownership` mode
is an error, not a default. An older genx meeting `ownership: 'external'` will therefore refuse the
sync and report why.

That is correct behaviour, and it constrains the order: **genx must understand `external` before
ai-agent-config ships it.** The contract should also record the minimum genx version for each mode,
so this is discoverable rather than tribal.

Note this constraint is no longer on the critical path. The lockfile gate does the safety work;
`external` is the later declarative cleanup, and can land whenever it suits.

### 3. Migration stages a type change, and `git stash` refuses it

Every migrating repository holds `.claude/skills/<name>/` as a real directory today. Installing
replaces it with a symlink, which git stages as two entries at once:

```
A  .claude/skills/foo          <- the new symlink
D  .claude/skills/foo/SKILL.md <- a file inside the directory that no longer exists
```

`git stash create` cannot serialise that state, because the staged deletion asks it to reach through
the new symlink:

```
error: '.claude/skills/foo/SKILL.md' is beyond a symbolic link
fatal: Unable to process path .claude/skills/foo/SKILL.md
Cannot save the current worktree state
```

lint-staged takes that stash as its backup **before running any task**, so the commit aborts with
`Failed to back up original state` and not one check runs. Reproduced on git 2.55.0 / lint-staged
17.3.0, and observed in two repositories on 2026-08-23. It is not version-specific: git has always
refused to write beyond a symlink, and nothing in this ecosystem converted a tracked directory into
a symlink until skills migration.

This is not an edge case for the rollout — it is **every repository in step D**, because dual-write
put a real directory at that exact path in all of them.

**Resolution: commit the removal and the symlink as two commits.** Each half stages cleanly and
stashes fine, so the hook keeps running and nothing needs `--no-verify`:

| Commit | Staged                   | Stashes |
| ------ | ------------------------ | ------- |
| 1      | `D .claude/skills/foo/…` | Yes     |
| 2      | `A .claude/skills/foo`   | Yes     |

genx must do this itself in step C. `commitTrackedGitChanges` runs `git commit` with hooks enabled,
so a single-commit install fails in any repository whose hook backs up state — which is all of them.
`--no-verify` is the wrong escape: it would silently disable lint and format on a commit that
rewrites agent configuration.

Detection is cheap and does not need a symlink-specific check: any path staged as added whose
**prefix is also staged as deleted** is a type change, and splitting on that rule covers
file→directory and directory→symlink alike.

### The lockfile must be committed

Decision 4 makes `skills-lock.json` the gate: present means externally managed, absent means genx
dual-writes. That only holds if the file survives a clone.

An untracked lockfile makes every fresh clone look unmigrated, so genx dual-writes real directories
over the symlinks the CLI put there — hazard 1, reintroduced by a `.gitignore` line. Committing it
also makes `computedHash` drift reviewable, and lets `experimental_install` restore the same
versions on another machine. It is a lockfile in the ordinary sense, and gets the ordinary treatment.

Nothing in `_templates/.gitignore` excludes it today, and genx's own copy is tracked. This decision
exists so it stays that way.

## How genx invokes the CLI

genx runs the CLI rather than only reporting. `skills add` clones from GitHub and needs no local
checkout, which makes it strictly better than today's vendoring — that requires the
`@finografic/ai-agent-config` package resolved locally, so it fails on a fresh machine. The CLI's
`-a/--agent`, `-s/--skill` and `-y/--yes` flags mean it runs without opening a prompt inside genx's
own flow.

| Repository state                 | genx action                                                         |
| -------------------------------- | ------------------------------------------------------------------- |
| No lockfile                      | Offer `skills add finografic/ai-skills`                             |
| Lockfile present, skills absent  | `skills experimental_install` — deterministic restore from the lock |
| Lockfile present, hashes drifted | Offer `skills update`                                               |
| Lockfile present, hashes match   | Report and do nothing                                               |

Three constraints: **pin the CLI version**, as `genx clean` already pins its `dlx` target, so an
upstream release cannot change behaviour mid-upgrade; treat failure as **non-fatal**, since a
network blip must not abort an upgrade that is otherwise filesystem-local; and **split the commit**
per hazard 3, since `add` and `update` both replace directories with symlinks and a single commit
cannot be stashed.

`add` and `experimental_install` create the type change from scratch. `update` recreates it in any
repository where a previous genx `upgrade` overwrote a symlink with a real directory. Both paths
need the split, so it belongs in the shared commit helper rather than at one call site.

## Migration Strategy

Each step is independently shippable and safe to stop after. Only step A is blocking — everything
after it can happen at whatever pace suits, per repository.

**A. The lockfile gate (genx).** Before writing any skill, check for `skills-lock.json`; if present,
write nothing and report that skills are externally managed. **This is the step that makes it safe
to install the five shared skills anywhere.** It must be released and the global link rebuilt before
it protects anything.

**B. genx's own skills become canonical + symlink** (copy fallback). Self-contained; removes the
dual-write from the repository that argues against it.

**C. genx invokes the CLI** per the table above — add, restore, update — pinned and non-fatal.

**D. Migrate repositories, one at a time.** `npx skills add finografic/ai-skills` in each. Order does
not matter, and a half-migrated ecosystem is a valid steady state. Commit the removal and the
symlinks separately per hazard 3, and commit `skills-lock.json`.

**E. genx learns the `external` ownership mode**, then ai-agent-config flips its skill asset to it
and releases, recording the minimum genx version. Declarative cleanup, not a safety requirement.

**F. Retire the dual-write.** Once every managed repository has a lockfile, the branch is
unreachable. Delete it, its tests, ai-agent-config's `assets/skills/`, and that package's
`src/assets.test.ts` dual-write assertion — which encodes the rule being retired.

Steps A–C are genx-only and invisible to consumers. D is the first thing anyone notices.

## Open Questions

1. **Does the CLI invocation belong in `upgrade`, in `audit`, or both?** Decision 5 settles that genx
   invokes rather than only reports, but not where. `audit` is the feature-repair command and is the
   more natural home; `upgrade` is where people already are.

2. **Does `experimental_install` carry an experimental-ness risk worth avoiding?** It is the only
   deterministic restore path, and the name says it may move. Pinning the CLI version contains the
   blast radius, but a rename still forces a genx change.

3. **How does genx know a repository is "fully migrated" for step F?** `managed status` could report
   lockfile presence across all targets, which turns "is the dual-write dead yet" into a query
   rather than a memory.

### Resolved during drafting

- **Should genx run the CLI, or only report?** Run it. `skills add` clones from GitHub and needs no
  local checkout, so it works on a fresh machine where vendoring does not. Non-interactive flags mean
  no nested prompt. Decision 5.
- **Must dual-write survive the transition?** Yes — gated on the lockfile's absence, so unmigrated
  repositories keep receiving updates instead of silently freezing. Decision 6.
- **Do `scaffold-cli-help` and `scaffold-core-module` belong in a public repo?** Yes. They encode
  `@finografic` CLI conventions, and many of these projects are CLIs. Only genx-internal scaffolding
  stays out.
