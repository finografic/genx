# TODO: React Feature

Feature ID: `react`

## What it should do

- Add `"javascriptreact"` and `"typescriptreact"` to `eslint.validate` in `.vscode/settings.json`
- Add dprint formatter settings for `typescriptreact`, `javascriptreact`, `html` languages
  (css/scss handled by the css feature — React feature should not duplicate those)
- Extend `globals` in `eslint.config.ts` to include `globals.browser` for TSX/JSX files
- Add `react` / `react-dom` devDeps (or peer deps, depending on package type)
- Possibly add `eslint-plugin-react` / `eslint-plugin-react-hooks` rules to `eslint.config.ts`
- VSCode extension recommendation: `dsznajder.es7-react-js-snippets` (or similar)

## Detection

Check for `react` in `dependencies` or `devDependencies`.

## Open Questions

- Should globals switch from `node` → `browser` automatically, or always merge both?
- Do we add `eslint-plugin-react-hooks`? If so, what rules at what severity?
- HTML: include `[html]` dprint here, or keep it separate from css feature?
- `jsx` in `tsconfig.json` — does the feature need to set `"jsx": "react-jsx"`?
- Does this feature need to touch `package.json` `type` field or build config (tsdown)?

## Related

- css feature adds `css.validate: false`, `scss.validate: false`, dprint for css/scss
- dprint REACT category already adds tsx/jsx/css/scss/html if `react` is a dep — React
  feature's vscode.ts should coordinate with this (avoid double-adding)
- `eslint.validate` base is `["javascript", "typescript"]` — React feature appends the JSX entries
