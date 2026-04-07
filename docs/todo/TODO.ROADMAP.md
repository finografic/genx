# TODO.ROADMAP.md

Future enhancements identified during the deps-policy → genx → target pipeline walkthrough (2026-04-06).
Ordered roughly by dependency: earlier items are prerequisites for later ones.

---

## 1. Composable detect primitives

- [ ] status: pending

**Goal:** Replace per-feature hand-written `detect()` implementations with a small set of typed
predicate helpers combined via `allOf` / `anyOf`.

**Why:** Current `detect()` functions are bespoke per-feature and hard to audit. Bugs like the
oxfmt false-negative (detecting `oxfmt.config.ts` existence instead of declared deps + scripts)
are easy to introduce and hard to spot. A declarative approach eliminates an entire class of
detection error.

**Shape (proposed):**

```ts
import { allOf, hasDependency, hasScript } from 'utils/detect.utils';

export const detectOxfmt = allOf([
  hasDependency('oxfmt'),
  hasDependency('@finografic/oxfmt-config'),
  anyOf([hasScript('format:check'), hasScript('format:fix')]),
]);
```

Each primitive (`hasDependency`, `hasScript`, `hasFile`, `hasConfigBlock`) returns
`(context: FeatureContext) => Promise<boolean>`. `allOf` / `anyOf` compose them.

**Status:** Not started. Standalone value even without diff-as-detection.

---

## 2. jsdiff — per-file diff display

- [x] status: **DONE**

**Goal:** Before writing any file, show a per-file unified diff and ask the user to confirm
(yes / no / yes-to-all). Applies to `migrate`, `deps`, and future write operations.

**Why:** Currently the only feedback is a list of actions ("will update package.json"). A diff
lets the user see exactly what will change — which lines, which values — without needing to
run dry-run, inspect files manually, then run again with `--write`. Collapses two passes into one.

**Library:** `jsdiff` (kpdecker/jsdiff) — the standard programmatic JS diff library. **Not**
`diff-so-fancy` (a git CLI formatter, not a JS library). `jsdiff` works on strings in memory;
it never touches the filesystem or git.

**What it produces:** A unified diff string (same format as `git diff`). Rendered with
picocolors: `+` lines in green, `-` lines in red, `@@` hunks in cyan, filename in bold.
The confirmation prompt appears after each file's diff, or once at the end with yes-to-all.

**Scope:** Every file genx writes: `package.json`, `eslint.config.ts`, `AGENTS.md`,
`CLAUDE.md`, `.github/instructions/*.md`, `src/cli.help.ts`, etc. Any string-in / string-out
write operation can be wrapped with a diff + confirm step before the file is touched.

**Note:** jsdiff is used here purely for **user-facing display**. Diff-as-detection (#3) is
a separate (internal) use of the same library for a completely different purpose.

**Status:** Not started. No blocker — can be added independently of all other items.

---

## 3. Diff-as-detection

- [ ] status: pending

**Goal:** Replace hand-written `detect()` signal checks with a generate-and-diff approach:
run the feature's `apply()` logic against a copy of the current state, diff the result against
the actual file, and treat an **empty diff** as "feature already applied."

**Why:** Hand-written `detect()` functions are approximations — they check for signals that
_suggest_ a feature is present, not whether it is actually correct and complete. This diverges
over time. The oxfmt false-negative during the gli walkthrough (detect passed, apply found
missing pieces) is the canonical example: the detect logic was checking the wrong signals.
With diff-as-detection, the question becomes binary and exact: would `apply()` change anything?
If not, the feature is fully present. No separate detect logic to maintain or drift.

**How it differs from #2:** jsdiff (#2) is user-facing — show a diff to the developer before
writing. Diff-as-detection is internal — the diff is never shown to the user; it's used as a
boolean (`patch.length === 0`). Same library, entirely different role.

**Concrete example — oxfmt today (signal checks):**

```
detect checks: is 'oxfmt' in devDeps?  ✓
               is '@finografic/oxfmt-config' in devDeps?  ✓
               is 'format:check' in scripts?  ✓
→ detected as applied
→ but: 'update:oxfmt-config' script is missing, CI step uses wrong separator
→ apply finds real work to do — detect was wrong
```

**With diff-as-detection:**

```
generate: run apply() on the current package.json → produces proposed package.json string
diff:     createPatch(current, proposed)
result:   patch is non-empty → feature is NOT fully applied
→ apply() runs → correct, complete result every time
```

**Dependencies:** jsdiff (#2) for the diff primitive. Composable detect primitives (#1)
become unnecessary if this lands (they solve the same class of problem differently).

**Trade-off:** Runs the full `apply()` pipeline on every `detect` call — more expensive than
a few boolean checks. Acceptable for a developer CLI tool with a handful of features. If the
feature count grows large, results can be cached per-file per-run.

**Status:** Not started. Architectural — needs a dry-run / side-effect-free `apply()` contract
before implementation. Plan carefully; touches every feature.

---

## 4. `genx create` — apply resolvePolicy() immediately after scaffold

- [ ] status: pending

**Goal:** After scaffolding a new package, run `resolvePolicy(packageType)` and write the
resolved dependency versions directly into the new `package.json` instead of relying on the
hardcoded versions in `_templates/package.json`.

**Why:** `_templates/package.json` is a structural blueprint, not a version source of truth.
Newly created packages should get live versions from `@finografic/deps-policy` at scaffold time,
not stale versions baked into the template.

**Impact:** `_templates/package.json` dependency versions become irrelevant / can be cleared.
`genx create` already has access to `resolvePolicy()` through `dependencies.rules.ts`.

**Status:** Not started. Low risk — additive change to the create pipeline.

---

## 5. Type-specific policy divergence in deps-policy

- [ ] status: pending

**Goal:** Allow `library.ts` and `config.ts` in `@finografic/deps-policy` to intentionally
diverge from `base` where it makes sense (e.g., `config` packages probably do not need
`vitest` or `@types/node`).

**Why:** Currently both are empty, inheriting everything from `base` via `resolvePolicy`. As the
ecosystem matures, some package types legitimately need a different dep surface.

**Candidates:**

- `config` type: drop `vitest`, possibly `@types/node`
- `library` type: possibly add `@types/<something>` specific to the domain

**Status:** Deferred until concrete need arises. No urgency — empty files are correct today.

---

## 6. Bulk orchestrator — `deps-manager`

- [x] status: **DONE**

**Goal:** A script (or separate package) that discovers all `@finografic` packages by
filesystem and runs `genx deps --write` (or `genx migrate --only=dependencies --write`)
against each, reporting a summary.

**Why:** The current pull model requires running `genx deps` per-project manually. Fine for one
or two packages; tedious at ecosystem scale.

**Shape (proposed):** `deps-manager` CLI or pnpm script; takes a root directory, globs for
`package.json` files matching `@finografic/*`, runs `genx deps` in each.

**Status:** Not started. Separate concern from genx itself — probably lives in
`@finografic/project-scripts` or as a standalone workspace script.

---

## 7. Structured markdown section management

- [x] status: **DONE**

**Goal:** A generic utility for reading, diffing, reordering, adding, updating, and deleting
named sections in structured markdown files (AGENTS.md, CLAUDE.md, and similar).

**Why:** AGENTS.md and CLAUDE.md need to stay consistent across every `@finografic` project.
Currently this is done by hand — copying sections, re-ordering, reconciling diverged content.
One manual pass across several projects took ~1 hour. This should be a `genx migrate` section
like `package-json` or `eslint`.

**Section model:**

Each section is identified by its `## Heading`. Operations:

- **detect** — which sections are present / absent / have known outdated content
- **add** — insert a new section at a specified position (before/after anchor heading)
- **update** — replace a section's content (with diff confirmation via jsdiff #2)
- **delete** — remove a section
- **reorder** — move sections to match a canonical ordering

**Shape (proposed):**

```ts
import { parseSections, diffSection, writeSections } from 'lib/markdown-sections';

const sections = parseSections(fileContent); // Map<heading, body>
const patch = diffSection(sections, 'Skills', newBody);
// confirm via jsdiff UX, then:
writeSections(filePath, sections);
```

**Applies to:** `migrate` (existing command, new `--only=agents` / `--only=claude` sections),
and the new `ai-agents` feature (#8).

**Dependencies:** jsdiff (#2) for diff confirmation UX before any write.

**Status:** Not started. Design first — section boundary rules for arbitrary markdown files
need to be defined carefully (headings, code blocks, nested lists).

---

## 8. `ai-agents` feature — AGENTS.md + skills scaffold

- [ ] status: pending

**Goal:** New genx feature that manages the **agent interface layer** of a project:
`AGENTS.md` (the AI assistant guide and index) and `.github/skills/` (agent workflow procedures).

**Why:** Every `@finografic` project needs AGENTS.md kept consistent — the skills table,
general rules links, project-specific rules section, git policy section, and markdown table
rules. Skills (scaffold-cli-help, scaffold-feature, scaffold-core-module, etc.) also need to
be present in any project that uses those patterns. Today this is 100% manual.

**Feature boundary:**

```
ai-claude        → CLAUDE.md, .claude/         Claude Code CLI experience
ai-instructions  → .github/instructions/       Coding conventions (shared across all AI tools)
ai-agents        → AGENTS.md, .github/skills/  Agent interface: guide + workflow procedures
```

`ai-agents` and `ai-instructions` are complementary — AGENTS.md references instruction files,
so both features are typically applied together. They stay separate because instructions are
shared with non-agent tooling (Copilot, Cursor rules) while AGENTS.md is agent-specific.

**What `apply` does:**

- Scaffold `AGENTS.md` with canonical sections (skills table, general rules, git policy,
  markdown table rules) if absent
- If present: use section management (#7) to detect and update diverged sections
- Scaffold `.github/skills/` with project-relevant skill files (e.g. scaffold-cli-help
  only for CLI packages)
- Prompt for project-specific skills to include (multi-select)

**What `detect` checks:**

- `AGENTS.md` exists
- Skills table section is present
- Git policy section is present
- `.github/skills/` directory exists (if project has patterns that use skills)

**Dependencies:** Structured markdown section management (#7), which in turn needs jsdiff (#2).

**Status:** Not started. Dependent on #7. Blocking: define canonical AGENTS.md section set
and which skills apply to which package types.

---

## Non-starters (excluded)

- **Auto-publish on version bump** — too much automation risk; manual release gates are intentional.
- **Removing `--only` from `migrate`** — `deps` command coexists as a fast path; `--only` retains
  value for other granular migrate operations (e.g. `--only=eslint`).
