# oxfmt

Migrate an existing package to `oxfmt` + `@finografic/oxfmt-config` (for repos not created from the latest genx template).

## What it does

- Installs `oxfmt` and `@finografic/oxfmt-config`
- Creates `oxfmt.config.ts` (base preset; CSS overrides come from the **css** feature)
- Adds `format.check` / `format.fix` and `update.oxfmt-config` in the **PACKAGES** scripts section
- Replaces Prettier if present (uninstall + backup configs)
- Removes **dprint** / `@finografic/dprint-config` if still present (deps, `dprint.json(c)` / `dprint.config.jsonc`, lint-staged, scripts, VS Code `dprint.*` settings)
- Rewrites `.github/workflows/ci.yml` and `release.yml` so any `dprint` / `pnpm dprint check` steps use `pnpm format.check` instead
- Normalizes `lint-staged`: code glob runs `oxfmt` then `eslint --fix`; legacy `*.{json,…,toml}` / `*.{json,…,md}` data globs merge into `*.{json,jsonc,md,yml,yaml,toml}` with `oxfmt` only
- Adds format check to `release.check` / CI when missing
- Recommends `oxc.oxc-vscode`, marks the Prettier extension as unwanted
- Configures per-language default formatter and oxc editor settings in `.vscode/settings.json`
- Strips redundant `@stylistic/*` rules from `eslint.config.ts` that oxfmt fully covers

Dependency adds/removes use `pnpm add` / `pnpm remove`, so the lockfile updates during the feature (same idea as **`genx create`**, which runs `pnpm install` once after scaffolding). No extra install step is required unless you edit `package.json` by hand afterward.

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
