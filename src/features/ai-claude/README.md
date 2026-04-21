# ai-claude

Claude Code support: CLAUDE.md, session memory, handoff document, and settings.

## What it does

- Creates `CLAUDE.md` — project-specific instructions for Claude Code
- Creates `.claude/memory.md` — session breadcrumb log (gitignored)
- Creates `.ai/handoff.md` — project snapshot for bridging Claude Code ↔ Claude.ai (git-tracked; other `.ai/*` ignored). If `.ai/handoff.md` is missing but legacy `.claude/handoff.md` exists, preview migrates its body into `.ai/handoff.md` under **Imported from `.claude/handoff.md`** and removes the legacy file.
- Creates `.claude/settings.json` — Claude Code permissions (checked in)
- Creates `.claude/assets/.gitkeep` — keeps the shared Claude assets area scaffolded even when empty
- Ensures `.gitignore` ignores `.claude/` (re-admitting `settings.json`) and `.ai/` (re-admitting `handoff.md`)
- Auto-installs `ai-instructions` if `.github/instructions/` is missing

## Files

| File                         | Purpose                                                 |
| ---------------------------- | ------------------------------------------------------- |
| `ai-claude.constants.ts`     | File list and gitignore entries                         |
| `ai-claude.detect.ts`        | Check if all Claude Code files are present              |
| `ai-claude.handoff.utils.ts` | Merge legacy `.claude/handoff.md` into `.ai/handoff.md` |
| `ai-claude.apply.ts`         | Install files, ensure gitignore, auto-dep               |
| `ai-claude.feature.ts`       | Feature definition                                      |

## Handoff Document

`.ai/handoff.md` is a structured project-state snapshot intended to be manually shared with Claude.ai chat sessions. It gives an external Claude instance enough context to assist with planning, brainstorming, or design work — without access to the codebase.

The developer uploads the file to Claude.ai when starting a remote session, and may bring notes or decisions back to update the file during a local Claude Code session.

See the `## Handoff Document` section in `AGENTS.md` for the full authoring guide.
