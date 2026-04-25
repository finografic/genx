# oxc-config

Migrate an existing package to `@finografic/oxc-config` + `oxfmt` + `oxlint` (for repos not created from the latest genx template).

## What it does

- Installs `oxfmt`, `oxlint`, `oxlint-tsgolint`, and `@finografic/oxc-config`
- Removes legacy `@finografic/oxfmt-config` if present
- Creates `oxfmt.config.ts` (base preset; CSS overrides come from the **css** feature)
- Ensures `lint` / `lint:fix` / `lint:ci` scripts use oxlint
- Creates or updates `update:oxc-config` in the **PACKAGES** scripts section
- Adds `format:check` / `format:fix` scripts
- Removes legacy update scripts (`update:eslint-config`, `update:oxfmt-config`)
- Replaces Prettier if present (uninstall + remove configs)
- Removes **dprint** / `@finografic/dprint-config` if still present (deps, config files, lint-staged, scripts)
- Rewrites `.github/workflows/ci.yml` and `release.yml` so any `dprint` steps use `pnpm format:check` instead
- Normalizes `lint-staged`: code → `oxfmt` then `oxlint --fix`; `*.md` → `oxfmt` then `oxlint --fix`; data files → `oxfmt` only
- Adds format check to `release:check` / CI when missing
- Removes the ESLint/`@stylistic`/`globals` package stack and `eslint.config.*` files
- Recommends `oxc.oxc-vscode`, removes legacy `dprint.dprint` / `dbaeumer.vscode-eslint` recommendations
- Writes canonical `.vscode/settings.json` (oxc formatter, all language blocks, oxc/typescript preferences)

When dependency fields in `package.json` change, genx follows up with `pnpm install` automatically.

## Files

| File                                           | Role                                          |
| ---------------------------------------------- | --------------------------------------------- |
| `oxc-config.constants.ts`                      | Package names, scripts, lint-staged, CI       |
| `oxc-config.feature.ts`                        | Feature definition (id, label, detect, apply) |
| `oxc-config.detect.ts`                         | Detect existing oxc-config setup              |
| `oxc-config.apply.ts`                          | Apply preview changes + run pnpm install      |
| `oxc-config.preview.ts`                        | Canonical file changes for all owned surfaces |
| `oxc-config.preview.canonical-package-json.ts` | Compute canonical `package.json`              |
| `oxc-config.template.ts`                       | Generate `oxfmt.config.ts` content            |
| `oxc-config.workflows.ts`                      | Strip dprint from `ci.yml` / `release.yml`    |
| `oxc-config.dprint-cleanup.ts`                 | Strip dprint from lint-staged and scripts     |
| `oxc-config.simple-import-sort.ts`             | Strip `eslint-plugin-simple-import-sort`      |
