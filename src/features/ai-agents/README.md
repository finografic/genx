# AI Agents (AGENTS.md + skills)

Scaffolds and syncs the agent interface layer of a `@finografic` project.

## What it does

- Creates `AGENTS.md` from the canonical template if absent
- Merges existing `AGENTS.md`: enforces template bodies, strips legacy memory sections, dedupes duplicate Markdown Tables headings, and reorders sections (front matter → Rules spine → extras → Learned)
- Keeps enforced shared sections in sync with the template: **Project Memory Model**, **Roadmap and Planning Docs**, **Rules — Global**, **Rules — Markdown Tables**, and **Git Policy**
- Seeds **Rules — Project-Specific** once (never overwritten — project customises it)
- Copies portable agent skill procedures into `.github/skills/`
- Adds `scaffold-cli-help` and `scaffold-core-module` only for CLI package types
- Removes the genx-only `scaffold-feature` skill from generated targets

## Files

| File                     | Purpose                                           |
| ------------------------ | ------------------------------------------------- |
| `ai-agents.constants.ts` | Section headings, file paths, tier definitions    |
| `ai-agents.detect.ts`    | Checks AGENTS.md exists and has enforced sections |
| `ai-agents.feature.ts`   | Feature definition and metadata                   |
| `ai-agents.apply.ts`     | Scaffold / sync logic                             |
