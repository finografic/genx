# oxc-config

Migrate an existing package to `oxfmt` + `oxlint` + `@finografic/oxc-config` (for repos not created from the latest genx template).

## What it does

- Installs `oxfmt`, `oxlint`, and `@finografic/oxc-config`
- Creates `oxfmt.config.ts` and `oxlint.config.ts` (base presets; CSS overrides come from the **css** feature)
- Adds `format:check` / `format:fix`, `lint` / `lint:fix`, and `update:oxc-config` in the **PACKAGES** scripts section
- Replaces Prettier if present (uninstall + backup configs)
- Removes **dprint** / `@finografic/dprint-config` if still present (deps, `dprint.json(c)` / `dprint.config.jsonc`, lint-staged, scripts, VS Code `dprint.*` settings)
- Rewrites `.github/workflows/ci.yml` and `release.yml` so any `dprint` / `pnpm dprint check` steps use `pnpm format:check` instead
- Normalizes `lint-staged`: `*.{ts,…,cjs}` → `oxfmt` then `oxlint --fix`; `*.md` → `oxlint --fix` only; `*.{json,jsonc,md,yml,yaml,toml}` → `oxfmt` only (legacy data globs are merged)
- Adds format check to `release:check` / CI when missing
- Recommends `oxc.oxc-vscode`, marks the Prettier extension as unwanted
- Updates `.vscode/settings.json` with JSONC-aware patches (keeps `//` comments and unrelated keys): global oxc options sit just before `prettier.enable`; `[markdown]` is inserted before `markdownlint.config` when present
- **Legacy:** if `eslint.config.ts` exists, strips redundant `@stylistic/*` rules that oxfmt fully covers (ESLint is not installed by this feature)

When the feature changes dependency fields in `package.json`, genx follows up with `pnpm install` so the lockfile stays in sync automatically. Script-only or config-only updates do not trigger an extra install.

## Files

| File                      | Role                                       |
| ------------------------- | ------------------------------------------ |
| `oxc-config.constants.ts` | Package names, scripts, lint-staged, CI    |
| `oxc-config.detect.ts`    | Detect existing oxfmt/oxlint setup         |
| `oxc-config.apply.ts`     | Install and wire oxfmt + oxlint            |
| `oxc-config.template.ts`  | Generate `oxfmt.config.ts`                 |
| `oxc-config.vscode.ts`    | VSCode extensions + formatter settings     |
| `oxc-config.workflows.ts` | Strip dprint from `ci.yml` / `release.yml` |
| `oxc-config.feature.ts`   | Feature definition                         |
