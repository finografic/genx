# TODO — Maintain Project Memory Skill

> **Status:** Proposed (2026-06-02). Not started.

Add a future `maintain-project-memory` skill for reviewing and repairing the project memory model.

## Scope

- [ ] Add `.github/skills/maintain-project-memory/SKILL.md`.
- [ ] Keep `docs/process/PROJECT_MEMORY_MODEL.md` as the canonical explanation of file roles.
- [ ] Make the skill procedural: inspect, classify, deduplicate, repair, and summarize.
- [ ] Review `docs/todo/ROADMAP.md`, `docs/todo/NEXT_STEPS.md`, `.agents/handoff.md`, and
      `.agents/memory.md`.
- [ ] Move durable facts into handoff, priorities into roadmap, and concrete follow-ups into next
      steps.
- [ ] Keep session-only detail in memory and trim stale chronological history when appropriate.
- [ ] Remove duplicated content across the four files.
- [ ] Confirm changes with the user before rewriting existing project-authored content.

## Boundaries

- Do not move the canonical process documentation into the skill.
- Do not redefine TODO/DONE naming rules; link to
  `.github/instructions/documentation/todo-done-docs.instructions.md`.
- Do not overwrite project-specific roadmap, handoff, or memory content with generic templates.
