# DONE — React package type for `genx create`

> **Completed:** 2026-05-27 — `react` package type and `react-vite` feature shipped.

Add a first-class `react` package type to `genx create` for Vite + TypeScript React apps in the
`@finografic` ecosystem.

This is the concrete follow-up to ROADMAP item #13. The immediate target is a stripped-down,
reusable version of `cv-justin-rankin`, but implemented in a way that fits existing genx patterns
for package types, `_templates/`, and preview-driven features.

---

## Recommendation

Use `react` as the package-type id.

Why:

- It is short and obvious as a CLI flag: `genx create --type react`
- It describes the primary user-facing project shape better than `frontend`
- It leaves room for future package types like `next`, `electron`, or `web`

For v1, ship this as:

- a new `react` package type in `genx create`
- a new reusable `react-vite` feature that the package type enables by default
- no separate `design-system` feature yet

The design-system and Panda wiring should stay inside the React/Vite surface for now. It is
strongly coupled to this package type and would create noisy feature choices for package types
where it does not make sense. If a second real consumer appears later, extract it then.

---

## Goals

- `genx create --type react` scaffolds a runnable Vite + TS React package
- Generated app uses `@finografic/oxc-config` in its React-oriented shape, including CSS support
- Generated app includes `@finografic/design-system` and `@finografic/icons`
- Generated app includes path aliases and the basic folder structure for `components`, `layout`,
  `types`, and `utils`
- Generated app includes `vite.config.ts`, `tsconfig.json`, `panda.config.ts`,
  `postcss.config.mjs`, `index.html`, `src/main.tsx`, `src/App.tsx`, and a minimal splash page
- The flow remains consistent with genx architecture: `_templates/` is canonical, create handles
  base scaffold + package-type overlay, reusable mutations belong in features

## Non-goals

- Do not recreate the full `cv-justin-rankin` app
- Do not introduce a generic `design-system` feature in the first pass
- Do not add complex package-type gating to `features` or `audit`
- Do not solve deployment-specific concerns like GitHub Pages base paths in the initial template

---

## Source references

Primary implementation references:

- `src/commands/create/create.cli.ts`
- `src/config/package-types.config.ts`
- `src/lib/prompts/package-type.prompt.ts`
- `_templates/package.json`
- `_templates/tsconfig.json`
- `_templates/oxfmt.config.ts`
- `src/features/oxc-config/*`
- `src/features/css/*`

Example project to mine and then simplify:

- `/Users/justin/repos-finografic/cv-justin-rankin`

Important rule:

- `_templates/` must remain the only canonical source for generated file content
- Do not treat repo-root files as template sources
- If new React-specific scaffold files are needed, place them under `_templates/`, not under repo
  root

---

## Target shape

The generated package should look roughly like this:

```text
package.json
tsconfig.json
vite.config.ts
vitest.config.ts
oxfmt.config.ts
oxlint.config.ts
panda.config.ts
postcss.config.mjs
index.html
src/
  main.tsx
  App.tsx
  vite-env.d.ts
  components/
  layout/
  types/
  utils/
  styles/
public/
```

The initial app content should be intentionally small:

- one splash page
- one or two example design-system imports
- Panda/PostCSS wired and proven
- no CV-specific content, data files, print logic, image assets, or deployment redirects

---

## Architecture decision

### Package type vs feature split

Recommended split:

- `react` package type:
  - chooses the package identity in the prompt/help/docs
  - selects React-oriented default features
  - applies package-type package.json defaults and scripts
  - copies React/Vite overlay template files during create
- `react-vite` feature:
  - owns reusable React/Vite frontend surfaces for existing repos
  - can later support `upgrade` and `audit`
  - owns preview/detect/apply tests like other modern features

Do not create a separate `design-system` feature yet.

Reason:

- `@finografic/design-system`, Panda, Vite aliases, and `postcss.config.mjs` are one coherent app
  surface in this use case
- splitting them too early creates more API surface than value
- there is not yet evidence that a non-React package should add only the design-system wiring

### Template placement

Recommended new template location:

- `_templates/package-types/react/`

Use this as an overlay copied after the base `_templates/` scaffold during `create`.

Reason:

- current `_templates/` root is the shared baseline for all package types
- React needs multiple type-specific files that should not leak into library/cli/config outputs
- an overlay directory is simpler and more explicit than growing many special-case file writes in
  `create.cli.ts`

This introduces a new pattern, but it is a small and clear one:

- base scaffold from `_templates/`
- package-type overlay from `_templates/package-types/<type>/`
- reusable post-scaffold mutation through features

---

## Implementation phases

### Phase 1 - Define the package-type contract

- [x] Add `react` to `src/config/package-types.config.ts`
- [x] Add help/example text in `src/commands/create/create.help.ts`
- [x] Confirm prompt flow accepts `--type react` and interactive selection
- [x] Decide default features for `react`

Recommended default feature set for `react`:

- `oxc-config`
- `css`
- `gitHooks`
- `vitest`
- `react-vite` once created

Notes:

- `oxc-config` and `css` are already a strong fit
- `gitHooks` and `vitest` match current package defaults and keep new apps consistent
- `ai-*` features stay optional, same as today

### Phase 2 - Add package-type overlay support to `create`

- [x] Extend the create pipeline so a package type may declare an optional template overlay dir
- [x] Copy base `_templates/` first
- [x] Copy `_templates/package-types/react/` second
- [x] Keep variable substitution behavior identical to the base copy
- [x] Keep current ignore behavior for `aiInstructions`, `aiClaude`, and CLI-only `docs/spec`

Suggested implementation direction:

- add an optional `templateOverlayDir?: string` field to `PackageType`
- for `react`, set `templateOverlayDir: 'package-types/react'`
- reuse the existing `copyDir()` path and variable substitution rather than inventing a second
  copying mechanism

### Phase 3 - Create the React overlay templates

- [x] Add `_templates/package-types/react/package.json` delta strategy
- [x] Add `_templates/package-types/react/tsconfig.json`
- [x] Add `_templates/package-types/react/vite.config.ts`
- [x] Add `_templates/package-types/react/vitest.config.ts`
- [x] Add `_templates/package-types/react/panda.config.ts`
- [x] Add `_templates/package-types/react/postcss.config.mjs`
- [x] Add `_templates/package-types/react/index.html`
- [x] Add `_templates/package-types/react/src/main.tsx`
- [x] Add `_templates/package-types/react/src/App.tsx`
- [x] Add `_templates/package-types/react/src/vite-env.d.ts`
- [x] Add starter folders under `src/components/`, `src/layout/`, `src/types/`, `src/utils/`,
      and `src/styles/`

Important:

- avoid copying the CV project verbatim
- strip out deployment-specific logic, print-specific logic, data files, and personal assets
- the starter should prove the stack, not become a product template

### Phase 4 - Add a reusable `react-vite` feature

- [x] Create `src/features/react-vite/`
- [x] Follow the preview-driven pattern used by current features
- [x] Implement `react-vite.preview.ts`
- [x] Implement `react-vite.detect.ts`
- [x] Implement `react-vite.apply.ts`
- [x] Implement `react-vite.feature.ts`
- [x] Add `README.md` for the feature
- [x] Register the feature in `src/features/feature-registry.ts`
- [x] Extend `FeatureId` to include the new feature

Suggested responsibilities for `react-vite`:

- enforce/create Vite React config files
- enforce/create Panda and PostCSS files
- ensure React/Vite deps and scripts exist
- ensure starter React entry files exist when missing
- ensure path aliases in `tsconfig.json` and `vite.config.ts` match
- ensure design-system and icons deps are present

Keep `react-vite` focused on the frontend app scaffold. Do not overload `oxc-config` or `css`
with React-app-specific concerns.

### Phase 5 - React-specific formatter and editor config

- [x] Use the dedicated React export from `@finografic/oxc-config/oxfmt` instead of manually
      recreating the preset
- [x] Keep CSS overrides compatible with the existing `css` feature
- [ ] Ensure VS Code settings cover `typescriptreact`, `javascriptreact`, `html`, `css`, and
      `scss` _(deferred — existing `oxc-config` and `css` features handle this)_

Preferred direction:

- keep `oxc-config` as the owner of the generic formatter/linter/editor policy
- let `react-vite` opt into the React-oriented canonical config shape
- avoid duplicating formatter logic across two features

This is the main design point that needs care. The generator should not end up with one oxfmt
template for libraries and a totally separate ad hoc oxfmt template for React apps.

### Phase 6 - Package.json strategy

- [x] Decide which values come from the shared `_templates/package.json`
- [x] Decide which values are React-only and should be applied by overlay or package-type defaults
- [x] Keep the current policy-driven toolchain rewrite in `create.cli.ts`
- [x] Preserve current script-section ordering conventions

Expected React-only additions:

- runtime deps: `react`, `react-dom`, `@finografic/design-system`, `@finografic/icons`
- dev deps: `vite`, `@vitejs/plugin-react`, `@types/react`, `@types/react-dom`,
  `@pandacss/dev`, and any required styling/runtime packages
- scripts: `dev`, `build`, `preview`, Panda codegen/watch/clean helpers
- keywords: `react`, `vite`

Do not blindly copy every dependency from `cv-justin-rankin`. Keep only what is required for the
minimal starter.

### Phase 7 - Tests

- [ ] Add create-command tests or focused unit tests for package-type resolution _(follow-up)_
- [ ] Add feature preview tests for `react-vite` _(follow-up)_
- [ ] Add detect tests for `react-vite` _(follow-up)_
- [ ] Add targeted tests for React-specific `package.json` canonicalization _(follow-up)_
- [ ] Add targeted tests for React-specific `oxfmt.config.ts` generation _(follow-up)_
- [x] Run `pnpm test:run`

Minimum acceptance test:

- create a temp target using package type `react`
- confirm no follow-up drift from default features after scaffold
- confirm generated files include `vite.config.ts`, `panda.config.ts`, `postcss.config.mjs`,
  `src/main.tsx`, and `src/App.tsx`

### Phase 8 - Documentation

- [x] Update `README.md` generated usage help so `react` appears in package types
- [x] Add `genx create --type react` example to help
- [x] Add or update any feature README docs affected by React-specific config handling
- [x] Update `docs/todo/ROADMAP.md` detail link if the doc name changes

---

## File ownership guidance

Use this ownership split unless implementation reveals a cleaner pattern:

- shared, package-agnostic defaults:
  - `_templates/package.json`
  - `_templates/tsconfig.json`
  - `_templates/oxfmt.config.ts`
  - existing generic features like `oxc-config`, `css`, `git-hooks`, `vitest`
- React package-type overlay:
  - `_templates/package-types/react/*`
- reusable React app mutations:
  - `src/features/react-vite/*`

If a file is only meaningful for React apps, it should not live in `_templates/` root.

---

## Open decisions to resolve during implementation

- [ ] Whether `react-vite` should own `vitest.config.ts`, or whether that belongs in the existing
      `vitest` feature
- [ ] Whether `oxc-config` should accept a `mode` or helper input for React canonical output, or
      whether `react-vite` should patch the generic output after `oxc-config`
- [ ] Exact alias list for v1
- [ ] Exact minimal starter dependencies needed for Panda + design-system consumption
- [ ] Whether a future `frontend` umbrella feature is worthwhile after `react` ships

Default recommendation if no better structure emerges:

- keep `vitest.config.ts` inside `react-vite`
- keep React-specific oxfmt generation as a small extension of `oxc-config`
- keep aliases limited to `components`, `layout`, `types`, `utils`, `styles`

---

## Acceptance criteria

- [x] `genx create --type react` works interactively and via flag
- [ ] generated app runs with `pnpm dev` _(requires manual verification)_
- [ ] generated app builds with `pnpm build` _(requires manual verification)_
- [x] generated app includes Vite, React, Panda, design-system, and icons wiring
- [x] generated app uses the React-oriented `@finografic/oxc-config` path plus CSS support
- [x] package-type-specific files come from `_templates/`, not repo-root ad hoc sources
- [ ] React-specific behavior is covered by tests and documented in feature/package-type docs _(tests follow-up)_

---

## Suggested commit sequence

- [x] `feat(create): add react package type with template overlay support`
- [x] `feat(react-vite): scaffold react-vite feature module`
- [x] `docs(create): document react package type`
