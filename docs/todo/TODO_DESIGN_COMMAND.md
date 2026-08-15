# TODO - `genx design` Command (DESIGN.md ↔ design system machinery)

> **Primary repository:** this repo (`@finografic/genx`)
>
> **Role:** Deterministic machinery for the DESIGN.md convention — sync, drift check, render,
> lint. genx is the vehicle; policy and judgement stay elsewhere.
>
> **Depends on:** DESIGN.md convention + skills shipped in `@finografic/ai-agent-config`
> (`docs/todo/TODO_DESIGN_MD_SKILLS.md` there). Spec: Google/Stitch DESIGN.md
> (`npx @google/design.md`).
>
> **Origin:** `/Users/justin/repos-finografic/DESIGN_MD/DESIGN_MD_PLAN.md` (2026-08-13 session);
> supersedes the "Packaging" section of ai-agent-config's `TODO_DESIGN_MD_SYNC_SCRIPTS.md`.

## Outcome

`genx design <subcommand>` runs from any target project (`pnpm dlx`, zero footprint) and gives
the DESIGN.md convention its deterministic layer: refresh the token mirror from the canonical
design system, guard against drift in CI, render a human preview, and gate any write-back into
the design system behind genx's existing preview→confirm loop.

## Architecture Decision (locked)

| Layer                                                 | Owner                                                            | Why                                                                                                                                                                                                             |
| ----------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spec, skills, policy wording                          | `ai-agent-config`                                                | Content package; single source of truth for agent-facing material                                                                                                                                               |
| **Deterministic token machinery**                     | **genx (`design` command)**                                      | Parse/transform/diff work needs tests + exit codes, not model reasoning; CI must run it modelless; genx already owns preview/diff/confirm mechanics and target-project mutation; run-not-installed distribution |
| Judgement (generation, alignment, ambiguous mappings) | Skills (in ai-agent-config), which call `genx design *` as tools | Model reasoning drives; scripts execute                                                                                                                                                                         |

Explicitly rejected: shipping these scripts inside `ai-agent-config` (no CLI surface, heavy deps
pollute a content package) and a standalone `@finografic/design-md-tools` package (third home,
no distribution story genx doesn't already have; revisit only if `design` bloats genx).

## Subcommands

| Subcommand           | Behaviour                                                                                                                                                                                                                            | Model needed               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| `design sync --pull` | Extract tokens from the canonical design system → regenerate DESIGN.md YAML frontmatter. Markdown body (prose/rationale) is human-owned and byte-preserved                                                                           | No                         |
| `design sync --push` | DESIGN.md frontmatter → design system files. Opt-in, preview-gated per file (writes into `panda.config.ts` / `@theme` CSS / `globals.css` vars). Only legal when DESIGN.md is declared canonical in its `## Source of Truth` section | No (see push-mapping note) |
| `design check`       | Drift guard: regenerate mirror in-memory, `@google/design.md diff` semantics, non-zero exit on token drift/regression. CI-able                                                                                                       | No                         |
| `design render`      | DESIGN.md → self-contained `DESIGN.html` preview (swatches, type specimens, spacing/radius scales, component cards). Generated artifact, gitignored by default                                                                       | No                         |
| `design lint`        | Thin wrapper over `npx @google/design.md lint` (JSON out, exit codes passed through)                                                                                                                                                 | No                         |

**Push-mapping note:** naming mappings can be ambiguous (e.g. DESIGN.md `colors.primary` onto
Panda `semanticTokens` structure). The command takes an explicit, committable mapping file when
heuristics fail and errors loudly instead of guessing. A thin `sync-design-md` skill (model
resolves the mapping, then invokes the command) is deliberately deferred until push proves
ambiguous in real use — do not build it speculatively.

## Extractors / writers (per framework)

| Framework                              | Pull (extract)                                                                                      | Push (write)                                                                                           |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| PandaCSS / `@finografic/design-system` | load `panda.config.ts` → `theme.tokens` + `semanticTokens`; `recipes` → `components`                | generate `tokens.gen.ts` (`defineTokens` fragment spread into config) — never edit the config in place |
| Tailwind v4                            | parse `@theme` custom properties (`--color-*`, `--font-*`, `--text-*`, `--spacing-*`, `--radius-*`) | rewrite the `@theme` block                                                                             |
| Tailwind v3                            | `resolveConfig().theme`                                                                             | `theme.extend` JSON via official `export --format tailwind`                                            |
| shadcn/ui                              | `:root` / `.dark` CSS vars in `globals.css` (hsl → hex)                                             | rewrite the variable blocks (hex → hsl)                                                                |
| DTCG `tokens.json`                     | direct W3C mapping                                                                                  | official `export --format dtcg`                                                                        |

Prefer wrapping `@google/design.md` (lint/diff/export + programmatic `lint()` API) over
reimplementing. New deps kept minimal: `yaml`, small color-space lib (`culori`); avoid
style-dictionary unless a real need appears.

## Dark mode — decided 2026-08-13

**DESIGN.md mirrors the base (light) palette only. Dark stays canonical in the design system.**

The spec has no theme concept: `colors` is a flat `<token-name>: <Color>` map, with no conditions,
variants, or modes anywhere in the schema. Confirmed against the spec and the real linter:

| Option                              | Verdict                                                                    |
| ----------------------------------- | -------------------------------------------------------------------------- |
| Repeated `## Colors` section        | **Illegal** — spec: duplicate section heading is "Error; reject the file"  |
| Custom top-level key (`colorsDark`) | Warned and inert — "will be silently ignored by export commands"           |
| Suffix convention (`surface-dark`)  | Legal, but doubles every token (128 → 256 here), burying the design intent |
| Mirror base only, state it          | **Chosen** — matches the spec rather than bending it                       |

Both real pilots have two palettes (PandaCSS: 39 `_dark` conditions; shadcn: 31 `.dark` overrides),
so the omission is real and must not be silent. Pull therefore warns with the count, and a
generated DESIGN.md says in its `## Source of Truth` section that this is the base palette — an
agent must not infer that only one exists.

Revisit only if the spec gains a theme concept, or if an agent is observed applying light values in
a dark context because of this file.

## Non-Goals

- No new shared policy wording in genx (stays in `ai-agent-config`).
- No second palette in DESIGN.md, by any encoding (see Dark mode above).
- No DESIGN.md _generation_ — that is the `generate-design-md` skill (judgement).
- No skill installation logic — the existing asset-manifest pipeline already distributes skills.
- No editor app (see ai-agent-config `TODO_DESIGN_MD_EDITOR.md`; it can reuse `design render`).
- `-y` must never let `sync --push` silently mutate a project's design system.

## Phase 1 - Command skeleton + pull + check (MVP) — DONE 2026-08-13

- [x] `src/commands/design/` following the existing command folder conventions.
- [x] Shared core in `src/lib/design-md/`: DESIGN.md parse (frontmatter + body split),
      token model, `## Source of Truth` section reader (`source-of-truth:` frontmatter key
      wins over prose heuristic).
- [x] Extractors: PandaCSS (jiti-loaded config; recipes→components deliberately skipped —
      too far from spec sub-tokens to map mechanically) + Tailwind v4 (`@theme` parser).
- [x] `design sync --pull` with body preservation; idempotent (second run = no diff).
- [x] `design check` with clean JSON/text output and exit codes.
- [x] Fixtures: panda project, tailwind v4 project; hand-edited prose + no-design-system
      refusal covered in `design-e2e.test.ts`.

### Phase 1 acceptance

- [x] `pull` twice is byte-idempotent; prose never touched (e2e-tested).
- [x] `check` exits non-zero on a seeded token drift, zero otherwise (e2e-tested).
- [x] Works via `pnpm dlx` from a target cwd with no install (all deps runtime: yaml, jiti,
      @google/design.md).

## Phase 2 - render + lint — DONE 2026-08-13

- [x] `design render` — one self-contained HTML file, no external assets
      (swatches, specimens, scales, component cards, prose).
- [x] `design lint` via the programmatic `@google/design.md/linter` API (not npx —
      version-pinned as a real dependency).
- [x] Wire `render` output pattern into `.gitignore` handling — preview-gated; see Phase 4.

## Phase 3 - push (preview-gated) — DONE 2026-08-13 (shadcn deferred)

- [x] Writers: Tailwind v4 `@theme` (rebuilds owned namespaces `--color-*`/`--radius-*`/
      `--spacing-*`, preserves everything else; semantic no-op detection so reordering never
      prompts) + PandaCSS `tokens.gen.ts` (config never edited in place).
- [x] Refuse to push into a `@theme` whose owned entries are `var()` pointers. Pull now resolves
      that indirection, so writing the resolved values back would inline the base palette and
      detach the `.dark` overrides — breaking dark mode silently. Errors with the offending
      property names instead.
- [ ] shadcn CSS-vars writer — **effectively closed by the dark-mode decision.** The premise was
      stale anyway (current shadcn emits `oklch()`, not hsl, so no conversion is needed), and
      since DESIGN.md carries one palette by design, a writer could only ever author `:root` while
      leaving `.dark` untouched — which the push guard already refuses as unsafe. Revive only if
      DESIGN.md ever becomes canonical for a shadcn project, which no project does today.
- [x] Reuse feature-preview/confirm loop; per-file confirmation; refuse unless DESIGN.md
      declares itself canonical. `-y` is ignored for push by construction.
- [ ] Mapping-file support — deferred per the push-mapping note (build when ambiguity is
      proven in real use).

## Phase 4 - audit integration (thin feature) — DONE 2026-08-13

- [x] `design-md` feature: `genx audit` reports DESIGN.md presence and token drift
      (`design check` under the hood). `missing` points at the `generate-design-md` skill;
      `partial` means the mirror has drifted.
- [x] **Apply refreshes, never authors.** The original wording here was "audit never generates or
      mutates DESIGN.md", which would leave a `partial` entry that no-ops when selected — a dead
      end in the audit UX. Apply now runs the same preview-gated `sync --pull` that refreshes a
      drifted mirror, and still refuses to create one from nothing: authoring means consolidating
      inconsistencies and naming design intent, which is the skill's judgement work, not an
      unattended sync's.
- [x] New `Feature.applicable` predicate. Without it the feature reads `missing` in every package
      that has no design system — noise, not a finding. It is now omitted from the audit entirely
      there. First conditional feature; parallels the existing `selfPackageName` exclusion.
- [x] `render` offers its artifact to `.gitignore` (preview-gated, `# Design` section, extends an
      existing section rather than duplicating it). A project with no `.gitignore` is left alone —
      creating one is a bigger decision than this command should make.

### Fixed along the way

- **A partial group could silently delete hand-authored tokens.** Pull replaces a token group
  wholesale whenever the extractor produces at least one entry for it. Adding a single
  `--text-caption` to a project's `@theme` therefore flipped `typography` from hand-authored to
  mirrored, and the next pull proposed deleting the five hand-authored entries alongside it.
  Interactively the diff shows this; with `-y` — which `genx audit` and `genx managed audit` use —
  it would not. The entry is genuinely ambiguous (hand-authored vs retired upstream) and genx keeps
  no record of which, the same ambiguity as ADR 0003. Pull now **refuses under `-y`** when it would
  remove any token, naming them, and writes nothing; interactive pull is unchanged. Found by using
  the tool on a real project, not by a test.
- **Design-system detection scanned the whole tree.** `fg.sync('**/*.css')` meant a repository's
  own fixtures, demos, and example apps registered as its design system — genx detected its
  `test/fixtures/**` Tailwind projects and offered the feature on that basis. Detection is now
  anchored at conventional stylesheet roots (`*.css`, `src/**`, `app/**`, `styles/**`, `assets/**`).
  Found by running the audit against real repositories, not by a test.

## Validation

- [x] Focused tests per extractor/writer with fixtures (55 design tests; 300 repo-wide green).
- [x] Typecheck, lint, format on touched files; build + README usage regenerated.
- [x] Manual pilot: `pull` + `check` + `lint` + `render` against the real
      `@finografic/design-system` (PandaCSS) and `@finografic/lucide-manager`
      (Tailwind v4 + shadcn) — see below.
- [x] ai-agent-config skills (`generate-design-md`, `apply-design-md`) updated to reference
      `genx design lint/check/sync`.

### Pilot findings — 2026-08-13

Both extractors were tested only against fixtures hand-written to match what the code already did,
so the suite proved the code matched its own assumptions. Real input disagreed immediately, in both
frameworks, in the same way: **the tokens are never where the naive reading looks for them.**

#### PandaCSS — `@finografic-design-system/packages/design-system`

First run produced a DESIGN.md with **zero tokens** and reported success; the second produced 81
lint errors. Four defects, all fixed:

- **Presets were ignored.** The extractor read only `config.theme`, but a design system keeps its
  decisions in a preset (`presets: [designSystemPreset]`), leaving the top-level theme empty. Now
  walks object presets depth-first, config theme winning. Presets referenced by _name_ are
  deliberately not resolved — Panda's built-ins would bury the project's own tokens under a default
  palette — and are reported as a warning instead.
- **Pull wrote a token-less DESIGN.md and called it success.** Extracting nothing from a detected
  design system is now an error with an actionable message, not a silent empty mirror.
- **`color-mix()` ramps failed the spec linter** (81 errors) and told an agent nothing about the
  actual colour. Resolved to literal `oklch()` at extraction. Deliberately narrow — OKLCH space,
  `oklch()`/`white`/`black` operands only — anything else passes through untouched rather than
  being approximated. Widen with a colour library when a real project needs another form.
- **Panda's `DEFAULT` key leaked into token names.** `colors.primary.DEFAULT` became
  `primary-DEFAULT`, so the spec's `primary` was missing entirely and the linter warned that it
  would auto-generate key colours. `DEFAULT` is now stripped, in names and in `{refs}`.

Also: a bare `0` radius is not a valid dimension per the spec, so bare zeros in `rounded`/`spacing`
are emitted as `0px`.

After the fixes: 128 colours, 9 typography scales, 8 rounding levels, 20 spacing tokens;
`lint` clean, `check` in sync, second `pull` byte-idempotent, `render` produced a 28 KB
self-contained preview.

#### Tailwind v4 + shadcn/ui — `@finografic/lucide-manager`

Predicted from the PandaCSS result and confirmed on the first run: every colour mirrored as
`var(--primary)` and every radius as `calc(var(--radius) * 0.6)` — the indirection recorded, the
design lost, and nothing the linter would accept.

- **`@theme` entries point at a `:root` palette.** shadcn declares `--color-primary: var(--primary)`
  and defines the actual value in `:root`, with `.dark` overriding it. `var()` is now resolved
  transitively against `:root` (with fallback and cycle handling); an unresolvable reference is left
  as written. `.dark` is deliberately not mirrored — DESIGN.md carries one palette, the same rule
  the Panda extractor applies to `base` conditions.
- **Radius/spacing scales are arithmetic.** `calc()` is now evaluated (`+ - * /`, parentheses, one
  unit), so the scale reads `0.375rem` rather than an expression. Incompatible units or unsupported
  functions are returned unchanged rather than guessed at.
- **Push would have silently broken dark mode.** Because pull now resolves the indirection, a
  `--push` on a shadcn project would rewrite `@theme` with literals, orphaning the `.dark` block
  that redefines those custom properties. Push now refuses on any owned `@theme` entry containing
  `var()`, naming the properties. Caught by reasoning about the change, not by a failing test —
  the corresponding regression test came after.

Result: 31 colours and 7 rounding levels, 0 lint errors. The remaining warning (no typography) and
info (no spacing) are true statements about that project, not extractor gaps.

Pilot artifacts were removed from both repositories — neither keeps a DESIGN.md yet; that is a
decision for its owner, not a side effect of testing.

## Suggested Commit Slices

1. `feat(design): add design command skeleton and DESIGN.md core lib`
2. `feat(design): add pandacss and tailwind v4 extractors with pull`
3. `feat(design): add drift check with CI exit codes`
4. `feat(design): add html render and lint passthrough`
5. `feat(design): add preview-gated push writers`
6. `feat(audit): detect design-md drift via thin feature`
