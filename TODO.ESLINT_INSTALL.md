# TODO.ESLINT_INSTALL.md

## Goal

Update `@finografic/create` (and `migrate`) so that newly generated packages use the **canonical ESLint config template** shipped inside:

- `@finografic/eslint-config`
- (and optionally, formatting config from `@finografic/dprint-config`)

This replaces the current behavior where `eslint.config.ts` is copied from local `templates/` inside `@finografic/create`.

**Single source of truth** should live in the config packages themselves.

---

## Why

- Avoid duplicated templates across repos
- Keep generated projects aligned with the latest `@finografic/eslint-config` structure
- Enable iterative refactors to `@finografic/eslint-config` without manually updating `@finografic/create`
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

## dprint integration (optional)

If the user selects formatting via dprint in `@finografic/create`:

Install:

```bash
pnpm add -D dprint @finografic/dprint-config
```

Then either:

### Option A (recommended): copy config file

Copy from installed dependency:

```txt
node_modules/@finografic/dprint-config/dprint.json
```

To:

```txt
<new-package>/dprint.json
```

### Option B (advanced): use `extends`

Generate a lightweight `dprint.json`:

```json
{
  "extends": "node_modules/@finografic/dprint-config/dprint.json"
}
```

---

## Implementation notes for @finografic/create

### Required capabilities

- Determine installed package path at runtime (Node resolution)
- Copy template files from `node_modules/.../templates/*`
- Avoid hardcoding template content in `@finografic/create`

### Recommended approach

- Always copy from installed packages
- Treat config packages as immutable “golden sources”
- Keep `@finografic/create/templates/` as a fallback only (temporary)

---

## Acceptance criteria

A generated package should:

- Have `eslint.config.ts` created from `@finografic/eslint-config/templates/`
- Have the correct dependency installed
- Run `pnpm lint` successfully without manual changes
- If dprint option is selected:

  - have a `dprint.json`
  - support editor format-on-save

---

## Status

Blocked until:

- `@finografic/eslint-config` refactor is complete
- the package exports + templates are stable
- the package is ready to be depended on by `@finografic/create`

---

## Next tasks (when ready)

- [ ] Add `templates/` folder to `@finografic/eslint-config` package output (`files` whitelist)
- [ ] Add canonical `eslint.config.ts` template (layered)
- [ ] Add optional `eslint.config.fino.ts` template (bridge)
- [ ] Update `@finografic/create` to install dependency first, then copy template
- [ ] Update `migrate` to back up existing config and replace using canonical template
- [ ] Add a verification step (`pnpm lint`) to validate output
