# ai-instructions

Shared AI tooling instructions for GitHub Copilot, Cursor, and Claude Code.

## What it does

- Syncs `.github/copilot-instructions.md` from `_templates` (full file when content differs; stays under `.github/` since that's the only place Copilot itself reads from).
- Syncs each file under `.agents/instructions/` from `_templates`, **except** the `project/` subtree — that folder is never overwritten by genx (per-repo rules stay put).
- Syncs `.cursor/rules/*.mdc` from `_templates` (always-on Cursor rules that point at `AGENTS.md` and `.agents/instructions/`).
- Syncs **`AGENTS.md`** with **reverse apply** from **`_templates/AGENTS.md.template`** (canonical spine: **Rules — Project-Specific** → **Rules — Global** → **Rules — Markdown Tables** → **Git Policy**, plus shared bodies for General / Markdown / Git / **Agent execution efficiency** / Cursor). The target supplies **Rules — Project-Specific** body and any extra `##` sections; those land **after** the spine (merge order), with **Learned** last. Treat that template file as the spec — not the genx repo’s root `AGENTS.md`. Missing file: write the full template.

## Files

| File                              | Purpose                                    |
| --------------------------------- | ------------------------------------------ |
| `ai-instructions.constants.ts`    | File and directory paths for the feature   |
| `ai-instructions.agents.utils.ts` | Extract/replace `AGENTS.md` Rules — Global |
| `ai-instructions.detect.ts`       | Preview has no pending writes → aligned    |
| `ai-instructions.apply.ts`        | Apply preview changes (per-file confirm)   |
| `ai-instructions.preview.ts`      | Build diffs vs `_templates`                |
| `ai-instructions.feature.ts`      | Feature definition                         |

## Rule files

Canonical `*.instructions.md` files live under `.agents/instructions/`. The `project/` subfolder is for **project-only** instructions; genx does not sync template content into it.

## Dependency

`ai-memory` lists `ai-instructions` as an auto-dependency — running `ai-memory` on a project without `.agents/instructions/` will install `ai-instructions` first.

## See also

- **`docs/TEMPLATE_SOURCES_AND_AGENTS_MERGE.md`** — why only `_templates/` defines canonical merge/spine order, and how the algorithm works.
- **`.agents/skills/template-canonical-merge/SKILL.md`** — agent procedure for the same pattern on future features (genx-only skill; not distributed to other projects).
