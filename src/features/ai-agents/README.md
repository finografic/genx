# AI Agents (AGENTS.md + skills)

Scaffolds and syncs the agent interface layer of a `@finografic` project.

## What it does

- Creates `AGENTS.md` from the canonical template if absent
- Keeps three enforced sections in sync with the template: **Rules — General**,
  **Rules — Markdown**, **Git Policy**
- Seeds **Rules — Project-Specific** once (never overwritten — project customises it)
- Copies agent skill procedures into `.github/skills/` (scaffold-cli-help,
  scaffold-feature, scaffold-core-module) if not already present

## Files

| File                     | Purpose                                           |
| ------------------------ | ------------------------------------------------- |
| `ai-agents.constants.ts` | Section headings, file paths, tier definitions    |
| `ai-agents.detect.ts`    | Checks AGENTS.md exists and has enforced sections |
| `ai-agents.feature.ts`   | Feature definition and metadata                   |
| `ai-agents.apply.ts`     | Scaffold / sync logic                             |
