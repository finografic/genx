# ai-instructions

Shared AI tooling instructions for GitHub Copilot, Cursor, and Claude Code.

## What it does

- Syncs `.github/copilot-instructions.md` from `_templates` (full file when content differs).
- Syncs each file under `.github/instructions/` from `_templates`, **except** the `project/` subtree — that folder is never overwritten by genx (per-repo rules stay put).
- Syncs the **Rules — General** block in root `AGENTS.md` from `_templates/AGENTS.md` (or writes `AGENTS.md` when missing).
- Optionally updates `eslint.config.ts` ignore patterns for `.cursor/` paths.

## Files

| File                              | Purpose                                     |
| --------------------------------- | ------------------------------------------- |
| `ai-instructions.constants.ts`    | File and directory paths for the feature    |
| `ai-instructions.agents.utils.ts` | Extract/replace `AGENTS.md` Rules — General |
| `ai-instructions.detect.ts`       | Preview has no pending writes → aligned     |
| `ai-instructions.apply.ts`        | Apply preview changes (per-file confirm)    |
| `ai-instructions.preview.ts`      | Build diffs vs `_templates`                 |
| `ai-instructions.feature.ts`      | Feature definition                          |

## Rule files

Canonical numbered `*.instructions.md` files live under `.github/instructions/`. The `project/` subfolder is for **project-only** instructions; genx does not sync template content into it.

## Dependency

`ai-claude` lists `ai-instructions` as an auto-dependency — running `ai-claude` on a project without `.github/instructions/` will install `ai-instructions` first.
