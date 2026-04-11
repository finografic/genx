# `_templates` as the only merge spec — and how `AGENTS.md` ordering works

## Principle

**Nothing outside `_templates/` should be treated as the canonical source** for what gets written or merged into packages created or updated by genx (including the **ai-instructions** feature). In particular, the **genx repository root** — for example root `AGENTS.md` with **Skills**, **Learned**, and long **Rules — Project-Specific** text — is a **consumer** of the same patterns, not the definition of the template.

Canonical shared content lives under **`_templates/`** (e.g. `_templates/AGENTS.md.template`, `_templates/.github/instructions/…`). The **`AGENTS.md`** and **`CLAUDE.md`** sources use a **`.template` suffix** in `_templates/` so they are not confused with live repo-root files; **`create`** / features map them to **`AGENTS.md`** / **`CLAUDE.md`** on output (see `resolveTemplateSourcePath`, `copyDir` in `src/utils/`). Features must load template paths via the templates directory (e.g. `getTemplatesDir()`), not by reading “whatever is at repo root.”

## Problem we hit

When syncing **`AGENTS.md`** with a **reverse apply** (target keeps repo-specific sections; shared lists come from the template), a simple **walk of the target file** plus **append missing template sections** produced **`## Rules — Project-Specific` at the bottom** whenever that block was missing from the target walk or only supplied from the template append step. That contradicted **`_templates/AGENTS.md.template`**, where **Project-Specific is first**, then **General**, then **Markdown Tables**, then **Git Policy**.

Using the **genx root** `AGENTS.md` as an informal spec made this worse: it orders **Skills** before **Project-Specific**, which is **not** what the **template** file defines.

## Solution (algorithm)

Implementation: `src/features/ai-instructions/ai-instructions.agents.utils.ts`.

1. **Parse** target and template into preamble + H2 sections.
2. **Merge** by walking **target** sections:
   - Unknown headings → keep target (extras).
   - **`Rules — Project-Specific`** → keep target body.
   - Shared blocks (**General**, **Markdown Tables**, **Git Policy**) → use **template** body.
   - Append any template section **not seen** in the target (e.g. missing Project-Specific).
3. **Reorder** the merged section list to match **`_templates/AGENTS.md.template`**:
   - **Spine (fixed order):** Project-Specific → General → Markdown Tables → Git Policy.
   - **Other sections** (e.g. Skills): after the spine, preserving their order in the merged list.
   - **`Learned …` sections:** last, preserving order.
4. **Preamble** from the **template** (e.g. `# AGENTS.md — AI Assistant Guide`).
5. **No-op** if the result equals the current target (avoid noisy writes).

Normalized heading keys (em dash vs hyphen, etc.) are centralized so spine membership is stable.

## Why reorder is separate

Merge-by-walking preserves **target** ordering, which is wrong for **canonical** layout once template sections are **appended**. A dedicated **reorder** pass encodes the **single source of truth**: the **template file’s** spine order, not any particular consumer repo.

## Agent-facing references

- **Skill (procedure for future work):** [template-canonical-merge](/.github/skills/template-canonical-merge/SKILL.md)
- **Feature README:** `src/features/ai-instructions/README.md`

## Tests

`src/features/ai-instructions/ai-instructions.agents.utils.test.ts` covers:

- Project-Specific **above** General.
- When Project-Specific was **only** appended from the template, it still ends **before** General.
- Extras such as **Skills** appear **after** the spine (matching the bundled template, which has no Skills section).
