# oxfmt (oxc-config)

Migrate an existing package to `@finografic/oxc-config` + `oxfmt` + `oxlint` (for repos not created from the latest genx template).

## What it does

- Installs `oxfmt`, `oxlint`, and `@finografic/oxc-config`
- Removes legacy `@finografic/oxfmt-config` if present
- Creates `oxfmt.config.ts` (base preset; CSS overrides come from the **css** feature)
- Creates or updates `update:oxc-config` in the **PACKAGES** scripts section
- Adds `format:check` / `format:fix` scripts
- Replaces Prettier if present (uninstall + remove configs)
- Removes **dprint** / `@finografic/dprint-config` if still present (deps, config files, lint-staged, scripts, VS Code `dprint.*` settings)
- Rewrites `.github/workflows/ci.yml` and `release.yml` so any `dprint` / `pnpm dprint check` steps use `pnpm format:check` instead
- Normalizes `lint-staged`: code → `oxfmt` then `oxlint --fix`; `*.md` → `oxfmt` then `oxlint --fix`; data files → `oxfmt` only (legacy data globs are merged)
- Adds format check to `release:check` / CI when missing
- Recommends `oxc.oxc-vscode`, marks Prettier extension as unwanted
- Updates `.vscode/settings.json` with JSONC-aware patches (keeps `//` comments and unrelated keys)
- **DEPRECATED (removal)**: deletes `eslint.config.*` files and removes the ESLint/`@stylistic` package stack from `package.json`

When the feature changes dependency fields in `package.json`, genx follows up with `pnpm install` so the lockfile stays in sync automatically.

## Files

| File                                      | Role                                         |
| ----------------------------------------- | -------------------------------------------- |
| `oxfmt.constants.ts`                      | Package names, scripts, lint-staged, CI      |
| `oxfmt.detect.ts`                         | Detect existing oxc-config setup             |
| `oxfmt.apply.ts`                          | Install and wire oxc-config / oxfmt / oxlint |
| `oxfmt.template.ts`                       | Generate `oxfmt.config.ts`                   |
| `oxfmt.vscode.ts`                         | VSCode extensions + formatter settings       |
| `oxfmt.workflows.ts`                      | Strip dprint from `ci.yml` / `release.yml`   |
| `oxfmt.preview.canonical-package-json.ts` | Compute canonical `package.json`             |
| `oxfmt.simple-import-sort.ts`             | Remove `eslint-plugin-simple-import-sort`    |
