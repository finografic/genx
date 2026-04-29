# TODO.ESLINT_INSTALL.md

## Goal

Update `@finografic/genx` (and `migrate`) so that newly generated packages use the **canonical ESLint config template** shipped inside:

- `@finografic/eslint-config`
- (and formatting via `@finografic/oxfmt-config` + `oxfmt`, already wired in `_templates/`)

This replaces the current behavior where `eslint.config.ts` is copied from local `templates/` inside `@finografic/genx`.

**Single source of truth** should live in the config packages themselves.

---

## Why

- Avoid duplicated templates across repos
- Keep generated projects aligned with the latest `@finografic/eslint-config` structure
- Enable iterative refactors to `@finografic/eslint-config` without manually updating `@finografic/genx`
- Make the ecosystem consistent and “platform-like” (CV-quality)

---

## Desired behavior (Create)

### High-level pipeline (future)

1. Scaffold a new package directory (workspace skeleton)
2. Initialize package manager files (`package.json`, etc.)
3. Install dependencies (including ESLint config package)
4. Copy canonical `eslint.config.ts` template from the installed dependency
5. Apply optional substitutions (package name, monorepo paths)
6. Run lint / verify step (optional, but recommended)

**Important:** the template must be copied **after** the dependency is installed, so the installed package is the source of truth.

---

## Installation order requirement

The generator must do:

1. install `@finografic/eslint-config` (latest)
2. resolve installed path
3. copy template file(s)

Example dependency install:

```bash
pnpm add -D @finografic/eslint-config eslint
```

Notes:

- `eslint` may already be included by the template, but the generator should ensure it exists.
- The goal is a working `pnpm lint` out of the box.

---

## Template sourcing (canonical)

`@finografic/eslint-config` must ship templates in its published package, for example:

```txt
node_modules/@finografic/eslint-config/templates/
  eslint.config.ts
  eslint.config.fino.ts   (optional bridge / legacy style)
```

The generator should copy one of these into the new project root:

```txt
<new-package>/
  eslint.config.ts
```

### Template selection

Default template should be the layered config style (preferred long-term):

- `templates/eslint.config.ts`

Optional alternative (migration / “zero config”):

- `templates/eslint.config.fino.ts`

---

## Desired behavior (Migrate)

For an existing repo:

1. Install latest `@finografic/eslint-config` (if missing)
2. Back up existing `eslint.config.*`
3. Copy canonical template from installed dependency
4. Apply any necessary project-specific modifications
5. Run `pnpm lint` / validate

Migration should be non-destructive and reversible.

---

## oxfmt (lint & format)

Formatting is standardized on **`oxfmt`** + **`@finografic/oxfmt-config`**. New packages already include `oxfmt.config.ts` in `_templates/`; the **`oxfmt`** genx feature migrates older repos.

Install (if adding manually):

```bash
pnpm add -D oxfmt @finografic/oxfmt-config
```

Config lives at the repo root as `oxfmt.config.ts` (see `_templates/oxfmt.config.ts`).

---

## Implementation notes for @finografic/genx

### Required capabilities

- Determine installed package path at runtime (Node resolution)
- Copy template files from `node_modules/.../templates/*`
- Avoid hardcoding template content in `@finografic/genx`

### Recommended approach

- Always copy from installed packages
- Treat config packages as immutable “golden sources”
- Keep `@finografic/genx/templates/` as a fallback only (temporary)

---

## Acceptance criteria

A generated package should:

- Have `eslint.config.ts` created from `@finografic/eslint-config/templates/`
- Have the correct dependency installed
- Run `pnpm lint` successfully without manual changes
- Have `oxfmt.config.ts` and formatter scripts consistent with `_templates/`

---

## Status

Blocked until:

- `@finografic/eslint-config` refactor is complete
- the package exports + templates are stable
- the package is ready to be depended on by `@finografic/genx`

---
