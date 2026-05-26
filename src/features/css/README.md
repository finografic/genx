# css

CSS/SCSS formatting via oxfmt with CSS-aware overrides.

## What it does

- Configures oxfmt (oxc) as the default formatter for `css` and `scss`
- Patches `oxfmt.config.ts`: adds `css` import and `{ files: ['*.css', '*.scss'], options: { ...css } }` when missing (standard genx layout)

## Files

| File               | Purpose                                   |
| ------------------ | ----------------------------------------- |
| `css.constants.ts` | Language IDs, config filename             |
| `css.detect.ts`    | Check if oxfmt CSS override is present    |
| `css.preview.ts`   | Preview CSS feature changes               |
| `css.apply.ts`     | Apply preview changes                     |
| `css.vscode.ts`    | VSCode settings and oxfmt formatter logic |
| `css.oxfmt.ts`     | Patch `oxfmt.config.ts` with CSS preset   |
| `css.feature.ts`   | Feature definition                        |
