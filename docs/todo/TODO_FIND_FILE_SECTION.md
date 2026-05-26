# TODO: Find / replace comment-delimited file sections (generic “find section”)

## Problem

Several genx flows edit **regions** inside text files (markdown headers, `.gitignore` `# Section`
blocks, YAML front matter, etc.). Today logic is **file-specific** (`parseSections`, gitignore
helpers, migration routines).

We need a **small, predictable toolkit** to:

1. **Find** a region by a delimiter convention (e.g. `# Agents` … until the next line that opens a new `#` section header).
2. **Replace** that region **in place** with canonical content (often sourced from
   `_templates/` to avoid duplicate sources of truth).
3. Optionally **insert** the region when missing (e.g. after another known section).

## Current implementation (genx)

- **`src/lib/gitignore-section.utils.ts`** — `findGitignoreCommentSectionRange()` for `.gitignore`
  `# Title` sections (Agents, Environment files, IDE, …).
- **`src/lib/agents-gitignore.utils.ts`** — loads the `# Agents` block from
  **`_templates/.gitignore`** and replaces or inserts it via `proposeAgentsGitignoreMerge()`.

## Target home: `@finografic/cli-kit`

These helpers should eventually live in **`@finografic/cli-kit`** under a dedicated surface, for
example:

- `packages/cli-kit/src/fs/find-section.ts` (name TBD), or
- `packages/cli-kit/src/fs-helpers/gitignore-section.ts` alongside other path/text helpers.

**Packaging:** `@finografic/cli-kit` should expose either:

- a **`fs/` or `fs-helpers/`** subtree for path-safe, newline-preserving text operations, or
- **`fs.utils.ts` / `fs.helpers.ts`** at package root if we keep the API narrow.

Genx would import from `@finografic/cli-kit` instead of duplicating.

## Documentation & roadmap

- **`docs/todo/ROADMAP.md`** (this repo) — tracks extraction/port to cli-kit.
- **`@finografic/cli-kit`** — add a matching **`ROADMAP.md`** or **`docs/roadmap.md`** entry when
  the package gains the module (copy/adapt this TODO’s wording for that repo).

## Acceptance criteria (future)

- [ ] Generic “find section” API documented with examples (gitignore + markdown H2).
- [ ] Tests that cover CRLF vs LF, missing section, and nested `#` lines that are **not** headers.
- [ ] Genx delegates gitignore Agents logic to cli-kit (single implementation).
