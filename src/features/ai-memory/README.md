# ai-memory

Project memory model for agentic coding workflows.

## What it does

Creates and repairs the cross-agent planning and memory structure used by @finografic projects:

- `docs/process/PROJECT_MEMORY_MODEL.md`
- `docs/todo/ROADMAP.md` with a `## Next` section
- `.agents/handoff.md`
- `.agents/memory.md`
- `AGENTS.md` Project Memory Model block (via `ai-agents` dependency)
- `.gitignore` rules for tracked handoff + ignored memory
- minimal `CLAUDE.md` pointer to `AGENTS.md`
- migration from legacy `.claude/memory.md` and `.claude/handoff.md`, followed by legacy-file deletion
- migration from legacy `docs/todo/NEXT_STEPS.md` into `ROADMAP.md#next`, followed by legacy-file deletion

## Files

| File                         | Purpose                                          |
| ---------------------------- | ------------------------------------------------ |
| `ai-memory.constants.ts`     | Owned paths, legacy paths, untrack list          |
| `ai-memory.detect.ts`        | Preview-driven detect / audit                    |
| `ai-memory.preview.ts`       | Orchestrates dependency + owned previews         |
| `ai-memory.preview-owned.ts` | Owned file changes, migrations, gitignore        |
| `ai-memory.apply.ts`         | Apply preview + untrack gitignored indexed paths |
| `ai-memory.feature.ts`       | Feature definition                               |

## Dependencies

- **`ai-agents`** — inserts/enforces the `## Project Memory Model` block in `AGENTS.md` without
  installing skills; skill scaffolding remains owned by the separately selectable `ai-agents` feature
- **`ai-instructions`** — auto-installed when `.github/instructions/` is missing (same as former `ai-claude`)

## Shared utilities

- `src/lib/ai-memory.utils.ts` — migration helpers and CLAUDE.md shim detection
- `src/lib/gitignore-index-sync.utils.ts` — `git rm --cached` for gitignored but indexed paths
- `src/lib/agents-gitignore.utils.ts` — canonical `# Agents` block merge from `_templates/.gitignore`
