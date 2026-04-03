# css

CSS linting via `stylelint` + `@stylistic/stylelint-plugin`.

## What it does

- Installs `stylelint` and `@stylistic/stylelint-plugin`
- Creates `stylelint.config.ts` with stylistic indentation/spacing rules (`satisfies Config`)
- Enables stylelint in `.vscode/settings.json` (disables built-in `css.validate`)
- Configures oxfmt (oxc) as the default formatter for `css` and `scss`
- Patches `oxfmt.config.ts`: adds `css` import and `{ files: ['*.css', '*.scss'], options: { ...css } }` when missing (standard genx layout)
- Adds VSCode extension recommendation

## Files

| File               | Purpose                                                |
| ------------------ | ------------------------------------------------------ |
| `css.constants.ts` | Package names, config content, VSCode settings         |
| `css.detect.ts`    | Check if `stylelint.config.ts` (or legacy JSON) exists |
| `css.apply.ts`     | Install + configure                                    |
| `css.vscode.ts`    | VSCode settings and oxfmt formatter logic              |
| `css.oxfmt.ts`     | Patch `oxfmt.config.ts` with CSS preset                |
| `css.feature.ts`   | Feature definition                                     |

## VSCode Extension

`stylelint.vscode-stylelint`

## `stylelint.config.ts`

```ts
import type { Config } from 'stylelint';

export default {
  plugins: ['@stylistic/stylelint-plugin'],
  rules: {
    '@stylistic/indentation': 2,
    '@stylistic/no-extra-semicolons': true,
    '@stylistic/max-empty-lines': 1,
  },
} satisfies Config;
```
