---
name: triage-docs
description: Triage planning and design documents from agent output locations into docs/specs/ or docs/drafts/. Use when a session has produced design docs, plans, or checklists that need to be organized, or when docs/superpowers/ or similar ad-hoc directories exist.
trigger: Agent output directories contain planning artifacts, or user asks to organize/triage docs
tools: [file-create, file-edit, terminal]
---

# Triage Planning Documents

This skill organizes planning artifacts produced by agents (Cursor, Claude Code, GPT, etc.) into the project's canonical documentation structure.

Before proceeding, read `12-design-specs.instructions.md` for the rules governing `docs/specs/` and `docs/drafts/`.

## When to invoke

- After a session that produced design documents, plans, or specs in ad-hoc locations
- When directories like `docs/superpowers/`, `docs/planning/`, `.cursor/plans/`, or `.claude/drafts/` exist
- When the user asks to organize, triage, or clean up planning docs
- During `genx migrate` if ad-hoc doc directories are detected

## Preferred: use the triage script

```bash
pnpm triage:docs
```

The script scans known agent output locations, suggests a category for each file based on content markers, and prompts for the action (move to specs, move to scratch, delete, or skip). It also cleans up empty directories afterward.

For additional directories not in the default scan list:

```bash
pnpm triage:docs --scan-dir=custom/path
```

## Manual triage (when the script is unavailable)

### Step 1 — Identify artifacts

Check these locations for markdown files:

- `docs/superpowers/` (Cursor superpowers skill output)
- `docs/superpowers/specs/`
- `docs/superpowers/plans/`
- `docs/planning/`
- `docs/drafts/`
- `.cursor/plans/`
- `.claude/drafts/`

### Step 2 — Classify each file

Read the content and classify:

**Spec** (move to `docs/specs/`) — has lasting architectural value. Indicators:

- Contains sections like Goal, Non-Goals, Decision Summary, Architecture, Migration Strategy
- Documents a design decision with trade-offs and alternatives
- Would help a future developer understand _why_ something was built a certain way

**Scratch** (move to `docs/scratch/`, gitignored) — ephemeral, served its purpose. Indicators:

- Task checklists (`- [ ]`, `- [x]`)
- Manual test steps or verification notes
- Session-specific planning that won't be referenced again

**Discard** — no remaining value. Delete the file.

### Step 3 — Move files

```bash
# Ensure target directories exist
mkdir -p docs/specs docs/scratch

# Move specs
mv docs/superpowers/specs/2026-04-07-my-design.md docs/specs/

# Move scratch (gitignored)
mv docs/superpowers/plans/my-checklist.md docs/scratch/

# Clean up empty directories
rmdir docs/superpowers/specs docs/superpowers/plans docs/superpowers 2>/dev/null
```

### Step 4 — Verify

- `docs/specs/` contains only lasting design documents
- `docs/scratch/` is gitignored and contains only ephemeral material
- No orphaned agent output directories remain

## Naming conventions

Spec files: `YYYY-MM-DD-<slug>.md` (e.g. `2026-04-07-diff-as-detection-design.md`)

Scratch files: no strict naming — they're gitignored and temporary.

## Adding new scan locations

If a new agent tool creates planning artifacts in a novel location, add that path to the `DEFAULT_SCAN_DIRS` array in `scripts/triage-docs.ts` and update this skill's Step 1 list.
