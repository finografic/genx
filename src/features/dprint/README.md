# dprint

Code formatting via `@finografic/dprint-config`.

## What it does

- Installs `@finografic/dprint-config`
- Creates `dprint.jsonc`
- Adds `format` / `format.check` scripts
- Replaces Prettier if present (uninstall + backup configs)
- Adds VSCode extension recommendation
- Configures language formatters in `.vscode/settings.json`

## Files

| File                  | Purpose                                     |
| --------------------- | ------------------------------------------- |
| `dprint.constants.ts` | Package names, scripts, language categories |
| `dprint.detect.ts`    | Check if dprint already installed           |
| `dprint.apply.ts`     | Install + configure dprint                  |
| `dprint.template.ts`  | Generate `dprint.jsonc` content             |
| `dprint.vscode.ts`    | VSCode settings logic (lang detection)      |
| `dprint.feature.ts`   | Feature definition                          |

## Language Categories

Formatter settings added based on project deps:

- **DEFAULT**: javascript, json, jsonc (always)
- **TYPESCRIPT**: typescript (if `typescript` dep)
- **REACT**: tsx, jsx, css, scss, html (if `react` dep)
- **MARKDOWN**: markdown (always)
- **DATA**: yaml, toml (always)
