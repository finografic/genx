# css

CSS / SCSS formatting via **oxc** (`oxfmt` presets) and **migration cleanup** of legacy Stylelint.

## What it does

- Removes `stylelint` and `@stylistic/stylelint-plugin` from `package.json` when present
- Deletes `stylelint.config.ts` and `.stylelintrc.json` when present
- Strips Stylelint-related keys from `.vscode/settings.json` and removes the `stylelint.vscode-stylelint` recommendation from `.vscode/extensions.json`
- Restores VS Code built-in `css.validate` / `scss.validate` when they were set to `false` only for the old Stylelint workflow (removes the `false` entries)
- Configures **oxc.oxc-vscode** as the default formatter for `css` and `scss`
- Patches `oxfmt.config.ts`: adds the `css` preset import and `{ files: ['*.css', '*.scss'], options: { ...css } }` when missing

## Files

| File               | Role                                               |
| ------------------ | -------------------------------------------------- |
| `css.constants.ts` | Legacy Stylelint package names / paths for removal |
| `css.detect.ts`    | Detect when preview has no pending writes          |
| `css.preview.ts`   | Build diffs vs canonical CSS tooling               |
| `css.apply.ts`     | Apply preview + optional `pnpm install`            |
| `css.vscode.ts`    | VS Code JSONC transforms (strip Stylelint + oxfmt) |
| `css.oxfmt.ts`     | Patch `oxfmt.config.ts` for CSS presets            |
| `css.feature.ts`   | Feature definition                                 |
