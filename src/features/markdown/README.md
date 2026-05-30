# markdown

Markdown linting via `@finografic/md-lint`.

## What it does

- Installs `@finografic/md-lint`
- Splits a combined `*.{json,…,md}` lint-staged glob into data-only + `*.md` with `md-lint --fix`
- Ensures `.markdownlint.jsonc` extends `node_modules/@finografic/md-lint/.markdownlint.jsonc`
- Removes deprecated inline `markdownlint.config` from `.vscode/settings.json`
- Adds VSCode extension recommendation
- Migrates old preview-style paths and removes deprecated copied CSS assets from `.vscode/`

## Files

| File                    | Purpose                                          |
| ----------------------- | ------------------------------------------------ |
| `markdown.constants.ts` | Package name, VSCode settings, lint-staged globs |
| `markdown.detect.ts`    | Check if markdownlint installed                  |
| `markdown.apply.ts`     | Install + configure                              |
| `markdown.vscode.ts`    | VSCode settings logic (lang detection)           |
| `markdown.feature.ts`   | Feature definition                               |

## VSCode Extension

`davidanson.vscode-markdownlint`
