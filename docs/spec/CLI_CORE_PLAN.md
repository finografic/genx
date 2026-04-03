# Focused plan: CLI `core/` spec and tooling

This note tracks **narrow scope** now that the CLI core spec is canonical in genx (`docs/spec/CLI_CORE.md`) and staging folders (e.g. `___REFACTORING___`) are explicitly **non-canonical**.

## What is settled

| Topic                       | Decision                                                                  |
| --------------------------- | ------------------------------------------------------------------------- |
| Authoritative spec          | `docs/spec/CLI_CORE.md` in `@finografic/genx`                             |
| Short rules for agents      | `.github/instructions/project/*.instructions.md` (keep in sync with spec) |
| Procedures                  | `.github/skills/scaffold-*` link to spec; avoid duplicating full tables   |
| Staging / bulk-task folders | Optional scratch + migration reports only; never the spec of record       |

## Near term (maintenance)

1. **Edits to `core/` behavior or APIs** → update `docs/spec/CLI_CORE.md` first (Current Modules, export tables), then align instruction files and skills if wording drifted.
2. **Cross-repo propagation** (genx ↔ gli ↔ other CLIs) stays a **human/process** step until automated; the spec documents _what_ to keep identical, not _how_ to merge PRs.

## Later (optional automation — not blocking)

| Idea                         | When it pays off                                                |
| ---------------------------- | --------------------------------------------------------------- |
| `create` / scaffold copies   | After patterns stabilize; gate to **CLI-shaped** packages first |
| `migrate` / `features` hooks | When there is a repeatable transform, not a one-off bulk folder |
| CI or script “spec drift”    | If duplicated `core/` trees start to diverge in practice        |

## Out of scope for this plan

- Treating any `___REFACTORING___` path as required for agents or CI.
- Duplicating `docs/spec/CLI_CORE.md` into another repo as a second canonical copy (link or vendor from genx if ever needed).
