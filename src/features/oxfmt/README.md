# oxfmt

Migrate an existing package to `oxfmt` + `@finografic/oxfmt-config` (for repos not created from the latest genx template).

## What it does

- Installs `oxfmt` and `@finografic/oxfmt-config`
- Creates `oxfmt.config.ts` (base preset; CSS overrides come from the **css** feature)
- Adds `format:check` / `format:fix` and `update:oxfmt-config` in the **PACKAGES** scripts section
- Replaces Prettier if present (uninstall + backup configs)
- Removes **dprint** / `@finografic/dprint-config` if still present (deps, `dprint.json(c)` / `dprint.config.jsonc`, lint-staged, scripts, VS Code `dprint.*` settings)
- Rewrites `.github/workflows/ci.yml` and `release.yml` so any `dprint` / `pnpm dprint check` steps use `pnpm format:check` instead
- Normalizes `lint-staged`: `*.{ts,…,cjs}` → `oxfmt` then `eslint --fix`; `*.md` → `eslint --fix` only; `*.{json,jsonc,md,yml,yaml,toml}` → `oxfmt` only (legacy data globs are merged)
- Adds format check to `release:check` / CI when missing
- Recommends `oxc.oxc-vscode`, marks the Prettier extension as unwanted
- Updates `.vscode/settings.json` with JSONC-aware patches (keeps `//` comments and unrelated keys): global oxc options sit just before `prettier.enable`; `[markdown]` is inserted before `markdownlint.config` when present
- Strips redundant `@stylistic/*` rules from `eslint.config.ts` that oxfmt fully covers

When the feature changes dependency fields in `package.json`, genx follows up with `pnpm install` so the lockfile stays in sync automatically. Script-only or config-only updates do not trigger an extra install.

## Files

| File                 | Role                                       |
| -------------------- | ------------------------------------------ |
| `oxfmt.constants.ts` | Package names, scripts, lint-staged, CI    |
| `oxfmt.detect.ts`    | Detect existing oxfmt setup                |
| `oxfmt.apply.ts`     | Install and wire oxfmt                     |
| `oxfmt.template.ts`  | Generate `oxfmt.config.ts`                 |
| `oxfmt.vscode.ts`    | VSCode extensions + formatter settings     |
| `oxfmt.workflows.ts` | Strip dprint from `ci.yml` / `release.yml` |
| `oxfmt.feature.ts`   | Feature definition                         |
