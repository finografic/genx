---
name: template-canonical-merge
description: Enforce that canonical content for create/migrate/features comes only from `_templates/`, never from the genx repo root or ad hoc copies. Use when merging target files with templates (e.g. AGENTS.md), fixing section order, or adding similar “reverse apply + reorder” logic.
trigger: User mentions `_templates` as source of truth, template merge, AGENTS.md order, reverse apply, or “nothing outside _templates for templating”
tools: [file-read, file-edit, terminal]
---

# Template-Canonical Merge & Order Enforcement

## Non-negotiable invariant

**No part of anything outside `_templates/` is used as the specification for what gets templated** into consumer packages (create, migrate, `ai-instructions`, etc.). The **genx repo root** — including root `AGENTS.md`, root `.github/instructions/`, or hand-edited examples — is **not** the canonical layout for generated or merged output. Always read the **file under `_templates/`** (e.g. `_templates/AGENTS.md.template` — outputs **`AGENTS.md`** in packages).

If code loads a “template” path, it must resolve under **`getTemplatesDir()` / `_templates/`**, not the repository root (except where the running package _is_ the target being written, and even then shared blocks come from `_templates`).

## Pattern: reverse apply + spine reorder

Use this **algorithm** whenever you merge a **target** document with a **template** and must preserve repo-specific content while keeping a **fixed section order** defined by the template.

### 1. Parse both sides

- Split into **preamble** (content before the first `##`) and **H2 sections** (from each `##` through the next `##` or EOF).
- Normalize headings to stable keys (e.g. em dash vs hyphen): see `normalizeHeadingKey` in `src/features/ai-instructions/ai-instructions.agents.utils.ts`.

### 2. Walk the **target** once (merge)

- For each target section:
  - If the heading **does not exist** in the template → keep target body (extras: Skills, Learned, etc.).
  - If **`Rules — Project-Specific`** (or equivalent) → keep **target** body (repo-specific).
  - If the heading is a **shared template block** (e.g. Rules — Global, Markdown Tables, Git Policy) → substitute **template** body.
  - Otherwise → prefer template body if present, else target.
- After the walk, **append** any template sections whose keys were **never seen** in the target (e.g. missing Project-Specific).

This pass can leave **wrong vertical order** (e.g. Project-Specific appended at the end).

### 3. Reorder to the **template spine**

Define a **spine** = ordered list of normalized keys that match **`_templates/…`** (the template file is the single source of truth for order).

For `AGENTS.md`, spine order is:

1. `rules - project-specific`
2. `Rules — Global`
3. `rules - markdown tables`
4. `git policy`

Then:

- Emit spine sections **in that order** (using the merged bodies collected above).
- Emit **all other non-spine** sections (extras) in **document order** from the merged list, **after** the spine.
- Emit **`Learned …`** sections **last** (normalized key `learned …`), preserving their relative order.

Reference implementation: `reorderMergedAgentSections` in `ai-instructions.agents.utils.ts`.

### 4. Preamble

Use the **template** preamble (title line) so new packages match `_templates/AGENTS.md.template` / merged output exactly.

### 5. Idempotence check

If `proposed === normalizedTarget`, return no-op (`null` / no write).

## When to invoke this skill

- Adding or changing **template merge** behavior for any file under `_templates/`.
- Debugging **wrong section order** after a merge.
- Reviewing PRs that compare **root** `AGENTS.md` to **generated** output — remind: spec is **`_templates/AGENTS.md.template`** (not root).

## Related code

| Area            | Location                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------- |
| Merge + reorder | `src/features/ai-instructions/ai-instructions.agents.utils.ts`                                    |
| Preview wiring  | `src/features/ai-instructions/ai-instructions.preview.ts` (reads `_templates/AGENTS.md.template`) |
| Deep dive doc   | `docs/TEMPLATE_SOURCES_AND_AGENTS_MERGE.md`                                                       |

## Related skill

- **`maintain-agents`** — pruning **Learned** sections in an existing `AGENTS.md`; it does **not** define template merge rules.
