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

| #   | Decision                                                                                                                             | State       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| 1   | Skills are distributed by `npx skills add finografic/ai-skills`, never vendored by genx.                                             | **Adopted** |
| 2   | `finografic/ai-skills` is public, MIT, and carries `skills/` as its only discovery container.                                        | **Adopted** |
| 3   | Every skill layout — shared, third-party, and genx-local — is canonical copy plus symlinks, never two real copies.                   | Proposed    |
| 4   | ai-agent-config's skill asset moves to a new `external` ownership mode rather than being deleted from the manifest.                  | Proposed    |
| 5   | genx offers to run `npx skills update`; it never runs it silently.                                                                   | Proposed    |
| 6   | genx must ship `external` support **before** ai-agent-config emits it — fail-closed makes the reverse order an error. See Migration. | **Adopted** |

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

## The removal hazard

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

That is correct behaviour, and it fixes the migration order: **genx must understand `external`
before ai-agent-config ships it.** The contract should also record the minimum genx version for each
mode, so this constraint is discoverable rather than tribal.

## Migration Strategy

Each step is independently shippable and safe to stop after.

1. **genx learns `external`.** Add the mode to the ownership switch and the contract. No behaviour
   changes until a manifest emits it.
2. **genx converts its own skills to canonical + symlink**, with copy fallback. Self-contained,
   removes the dual-write from the repository that advocates against it.
3. **ai-agent-config flips its skill asset to `external`** and releases, noting the minimum genx
   version.
4. **Consumers upgrade.** genx reports skills as externally managed and touches nothing. Each repo
   runs `npx skills add finografic/ai-skills` once, at whatever pace suits.
5. **ai-agent-config deletes `assets/skills/`**, plus its `.agents/skills/` and `.claude/skills/`
   copies, and installs its own skills through the CLI like any other consumer.
6. **genx's `ai-agents` feature offers `npx skills update`** when `skills-lock.json` shows drift.

Steps 1–2 are genx-only. Step 3 is the first one consumers can observe.

## Open Questions

1. **Should genx run `npx skills` at all, or only report?** Running it during `upgrade` adds a
   network dependency and an `npx` fetch to a command that is otherwise filesystem-local. Reporting
   keeps genx's role advisory. Decision 5 proposes offering, never silently running; whether even
   the offer belongs in `upgrade` or only in `audit` is unresolved.

2. **What happens to `assets/skills/` in ai-agent-config?** Deleting it is clean, but the package's
   `src/assets.test.ts` asserts skills dual-write, and that test encodes the very rule being
   retired. Retire the test with the asset.

3. **Do `scaffold-cli-help` and `scaffold-core-module` belong in a public shared repo?** Both encode
   `@finografic` CLI conventions specifically. They are shared across this ecosystem but are not
   general-purpose the way `maintain-agents` is. Keeping them is harmless; the question is whether a
   public repository should present them as reusable.

4. **Does anything need to prevent a skill existing in both transports?** A repository could carry
   `maintain-agents` from `ai-skills` while an older genx still vendors it. Step 3's ordering makes
   this a transient state, but nothing detects it.
