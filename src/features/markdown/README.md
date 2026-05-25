# markdown

Markdown linting via `@finografic/md-lint`.

## What it does

- Installs `@finografic/md-lint`
- Splits a combined `*.{json,…,md}` lint-staged glob into data-only + `*.md` with `md-lint --fix`
- Adds `markdownlint.config` to `.vscode/settings.json` (JSONC-aware merge — does not strip existing `//` comments in that block)
- Adds VSCode extension recommendation
- Copies `markdown-github-light.css`, `markdown-custom-dark.css`, for preview styling

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
