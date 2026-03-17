# css

CSS linting via `stylelint` + `@stylistic/stylelint-plugin`.

## What it does

- Installs `stylelint` and `@stylistic/stylelint-plugin`
- Creates `.stylelintrc.json` with stylistic indentation/spacing rules
- Enables stylelint in `.vscode/settings.json` (disables built-in `css.validate`)
- Configures dprint as the default formatter for `css` and `scss`
- Adds VSCode extension recommendation

## Files

| File               | Purpose                                        |
| ------------------ | ---------------------------------------------- |
| `css.constants.ts` | Package names, config content, VSCode settings |
| `css.detect.ts`    | Check if `.stylelintrc.json` exists            |
| `css.apply.ts`     | Install + configure                            |
| `css.vscode.ts`    | VSCode settings and dprint formatter logic     |
| `css.feature.ts`   | Feature definition                             |

## VSCode Extension

`stylelint.vscode-stylelint`

## `.stylelintrc.json`

```json
{
  "plugins": ["@stylistic/stylelint-plugin"],
  "rules": {
    "@stylistic/indentation": 2,
    "@stylistic/no-extra-semicolons": true,
    "@stylistic/max-empty-lines": 1
  }
}
```
