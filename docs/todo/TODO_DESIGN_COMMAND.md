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

## Non-Goals

- No new shared policy wording in genx (stays in `ai-agent-config`).
- No DESIGN.md _generation_ — that is the `generate-design-md` skill (judgement).
- No skill installation logic — the existing asset-manifest pipeline already distributes skills.
- No editor app (see ai-agent-config `TODO_DESIGN_MD_EDITOR.md`; it can reuse `design render`).
- `-y` must never let `sync --push` silently mutate a project's design system.

## Phase 1 - Command skeleton + pull + check (MVP)

- [ ] `src/commands/design/` following the existing command folder conventions.
- [ ] Shared core in `src/lib/design-md/`: DESIGN.md parse (frontmatter + body split),
      token model, `## Source of Truth` section reader.
- [ ] Extractors: PandaCSS + Tailwind v4 (the two ecosystem-primary targets).
- [ ] `design sync --pull` with body preservation; idempotent (second run = no diff).
- [ ] `design check` with clean JSON/text output and exit codes.
- [ ] Fixtures: panda project, tailwind v4 project, project with hand-edited prose,
      project with no design system (command refuses pull: nothing canonical to pull from).

### Phase 1 acceptance

- [ ] `pull` twice is byte-idempotent; prose never touched.
- [ ] `check` exits non-zero on a seeded token drift, zero otherwise.
- [ ] Works via `pnpm dlx` from a target cwd with no install.

## Phase 2 - render + lint

- [ ] `design render` — one self-contained HTML file, no external assets.
- [ ] `design lint` passthrough wrapper.
- [ ] Wire `render` output pattern into `.gitignore` handling (existing section helpers).

## Phase 3 - push (preview-gated)

- [ ] Writers: Tailwind v4 `@theme`, PandaCSS `tokens.gen.ts`, shadcn CSS vars.
- [ ] Reuse feature-preview/confirm loop; per-file confirmation; refuse when
      `## Source of Truth` declares the design system canonical.
- [ ] Mapping-file support + loud failure on ambiguous mappings.

## Phase 4 - audit integration (thin feature, optional)

- [ ] `design-md` feature: `genx audit` detects DESIGN.md presence and drift
      (`design check` under the hood) and recommends action. Detection only — audit never
      generates or mutates DESIGN.md.

## Validation

- [ ] Focused tests per extractor/writer with fixtures; snapshot the generated frontmatter.
- [ ] Typecheck, lint, format on touched files.
- [ ] Manual pilot: run `pull` + `check` against a real `@finografic/design-system` consumer.
- [ ] Confirm ai-agent-config skills (`generate-design-md`, `apply-design-md`) reference the
      command correctly once shipped (update their SKILL.md tool lists).

## Suggested Commit Slices

1. `feat(design): add design command skeleton and DESIGN.md core lib`
2. `feat(design): add pandacss and tailwind v4 extractors with pull`
3. `feat(design): add drift check with CI exit codes`
4. `feat(design): add html render and lint passthrough`
5. `feat(design): add preview-gated push writers`
6. `feat(audit): detect design-md drift via thin feature`
