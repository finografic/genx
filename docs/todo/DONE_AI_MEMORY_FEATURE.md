# DONE — AI Memory Feature

> **Completed:** 2026-06-02 — replaced Claude-specific memory scaffolding with a cross-agent project memory model.

## Outcome

`ai-memory` is the canonical memory feature for generated and migrated projects.

It creates and repairs:

- `docs/process/PROJECT_MEMORY_MODEL.md`
- `docs/todo/ROADMAP.md`
- `docs/todo/NEXT_STEPS.md`
- `.agents/handoff.md`
- `.agents/memory.md`
- `.gitignore` agent-memory rules
- minimal `CLAUDE.md` pointer to `AGENTS.md`
- the `AGENTS.md` Project Memory Model block

## Migration

- Legacy `.claude/memory.md` content moves into `.agents/memory.md`, then the old file is deleted.
- Legacy `.claude/handoff.md` content moves into `.agents/handoff.md`, then the old file is deleted.
- Imported-content headings are stripped from the canonical files.
- `.agents/handoff.md` remains tracked while `.agents/memory.md` remains gitignored.

## Feature Boundaries

- `ai-memory` owns the memory-model documents and AGENTS memory section.
- `ai-instructions` remains an automatic dependency when shared instructions are missing.
- `ai-agents` owns portable skill scaffolding.
- Selecting `ai-memory` alone syncs the required AGENTS block without installing skills.

## Verification

- [x] Feature appears in generated README documentation.
- [x] Fresh install creates the expected memory-model files.
- [x] Legacy Claude memory and handoff files migrate and are deleted.
- [x] Existing roadmap and next-steps content is preserved.
- [x] Selecting AI Memory does not scaffold AI Agents skills.
- [x] Manual `genx audit` feature-install smoke pass completed.
