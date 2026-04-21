# markdown

Markdown linting via `@finografic/md-lint` (replaces legacy `eslint-plugin-markdownlint`).

## What it does

- Installs `@finografic/md-lint`
- Normalizes `lint-staged` for `*.md`: `oxfmt` + `md-lint --fix` (migrates legacy `eslint --fix` on markdown when present)
- Removes legacy `eslint-plugin-markdownlint` / `eslint-plugin-simple-import-sort` from devDependencies when present
- Strips markdownlint-related blocks from **legacy** `eslint.config.*` when present
- Adds `lint:md` / `lint:md:fix` scripts
- Adds `markdownlint.config` to `.vscode/settings.json` (JSONC-aware merge — does not strip existing `//` comments in that block)
- Adds VSCode extension recommendation
- Uses styles from the `md-lint` package for markdown preview (removes copied `.vscode/*.css` when redundant)

## Files

| File                    | Purpose                                    |
| ----------------------- | ------------------------------------------ |
| `markdown.constants.ts` | Package name, VSCode settings, lint-staged |
| `markdown.detect.ts`    | Check if md-lint is installed              |
| `markdown.apply.ts`     | Install + configure                        |
| `markdown.vscode.ts`    | VSCode settings logic (lang detection)     |
| `markdown.feature.ts`   | Feature definition                         |

## VSCode Extension

`davidanson.vscode-markdownlint`
