# oxfmt

Migrate an existing package to `oxfmt` + `@finografic/oxfmt-config` (for repos not created from the latest genx template).

## What it does

- Installs `oxfmt` and `@finografic/oxfmt-config`
- Creates `oxfmt.config.ts` (base preset; CSS overrides come from the **css** feature)
- Adds `format.check` / `format.fix` and `update.oxfmt-config` scripts
- Replaces Prettier if present (uninstall + backup configs)
- Prepends oxfmt to `lint-staged`, adds format check to `release.check` / CI when missing
- Recommends `oxc.oxc-vscode`, marks the Prettier extension as unwanted
- Configures per-language default formatter and oxc editor settings in `.vscode/settings.json`
- Strips redundant `@stylistic/*` rules from `eslint.config.ts` that oxfmt fully covers

## Files

| File                 | Role                                    |
| -------------------- | --------------------------------------- |
| `oxfmt.constants.ts` | Package names, scripts, lint-staged, CI |
| `oxfmt.detect.ts`    | Detect existing oxfmt setup             |
| `oxfmt.apply.ts`     | Install and wire oxfmt                  |
| `oxfmt.template.ts`  | Generate `oxfmt.config.ts`              |
| `oxfmt.vscode.ts`    | VSCode extensions + formatter settings  |
| `oxfmt.feature.ts`   | Feature definition                      |
