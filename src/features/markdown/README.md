# markdown

Markdown linting via `eslint-plugin-markdownlint`.

## What it does

- Installs `eslint-plugin-markdownlint`
- When needed, splits a combined `*.{json,…,md}` oxfmt glob into data-only + `*.md` with `eslint --fix` only (oxfmt for `*.md` still runs via the data glob that includes `md`)
- Adds markdown block to `eslint.config.ts`
- Adds `markdownlint.config` to `.vscode/settings.json`
- Adds VSCode extension recommendation
- Copies `markdown-github-light.css`, `markdown-custom-dark.css`, for preview styling

## Files

| File                    | Purpose                                     |
| ----------------------- | ------------------------------------------- |
| `markdown.constants.ts` | Package name, VSCode settings, ESLint block |
| `markdown.detect.ts`    | Check if markdownlint installed             |
| `markdown.apply.ts`     | Install + configure                         |
| `markdown.vscode.ts`    | VSCode settings logic (lang detection)      |
| `markdown.feature.ts`   | Feature definition                          |

## VSCode Extension

`davidanson.vscode-markdownlint`
