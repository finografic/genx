# oxc-config

Migrate an existing package to `@finografic/oxc-config` + `oxfmt` + `oxlint` (for repos not created from the latest genx template).

## What it does

- Installs `oxfmt`, `oxlint`, `oxlint-tsgolint`, and `@finografic/oxc-config`
- Removes legacy `@finografic/oxfmt-config` if present
- Creates `oxfmt.config.ts` (base preset; CSS overrides come from the **css** feature)
- Writes a minimal `oxlint.config.ts` using the inferred package-type preset from `@finografic/oxc-config/oxlint`
- Ensures `lint` / `lint:fix` / `lint:ci` scripts use oxlint
- Creates or updates `update:oxc-config` in the **PACKAGES** scripts section
- Ensures `format:check` / `format:fix` scripts use oxfmt
- Removes legacy update scripts (`update:eslint-config`, `update:oxfmt-config`)
- Replaces Prettier if present (uninstall + remove configs)
- Normalizes `lint-staged`: code → `oxfmt` then `oxlint --fix`; `*.md` → `oxfmt` then `oxlint --fix`; data files → `oxfmt` only
- Adds format check to `release:check` / CI when missing
- Recommends `oxc.oxc-vscode` in `.vscode/extensions.json`
- Removes legacy `dbaeumer.vscode-eslint` / `dprint.dprint` recommendations from `.vscode/extensions.json`
- Writes canonical grouped `.vscode/settings.json` (oxc formatter, ordered language blocks, oxc/typescript preferences)
- Removes associated legacy `eslint` / `dprint` dependencies and root config files
- Removes legacy `dprint` format-check steps from `.github/workflows/ci.yml`

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

## Notes

- VS Code settings ordering now goes through the shared grouped renderer in `src/utils/vscode-settings.*`.
- Legacy `eslint` / `dprint` cleanup is centralized in `src/lib/legacy-removal.utils.ts`.
