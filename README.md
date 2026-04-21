# 🦋 @finografic/genx

> Opinionated generator and codemod toolkit for the **@finografic** ecosystem.

This package provides a small CLI for:

- scaffolding new `@finografic` packages
- applying conventions (e.g. TypeScript) to existing repositories
- keeping project structure **consistent, minimal, and explicit**

It is designed to be **run**, not installed.

---

## 🚀 Usage

<!-- GENERATED:USAGE:START -->

Run directly using `pnpm dlx`:

```bash
pnpm dlx @finografic/genx <command> [options]
```

| Command    | Description                                  |
| ---------- | -------------------------------------------- |
| `create`   | Scaffold a new @finografic package           |
| `migrate`  | Sync conventions to an existing package      |
| `deps`     | Sync dependencies to @finografic/deps-policy |
| `features` | Add optional features to an existing package |
| `help`     | Show this help message                       |

### `genx create`

```bash
genx create
```

**Examples:**

```bash
# Create a new package interactively
genx create
```

### `genx migrate`

```bash
genx migrate [path] [options]
```

**Examples:**

```bash
# Dry run in current directory
genx migrate

# Dry run against a specific directory
genx migrate ../my-package

# Apply changes to a directory
genx migrate ../my-package --write

# Only update specific sections
genx migrate --only=package-json,workflows --write

# Update dependencies and Node version
genx migrate --only=dependencies,node --write

# Normalize file names and merge configs
genx migrate --only=renames,merges --write

# Migrate all managed targets
genx migrate --managed --write
```

### `genx deps`

```bash
genx deps [path] [options]
```

**Examples:**

```bash
# Dry run in current directory
genx deps

# Dry run against a specific directory
genx deps ../my-package

# Apply changes to current directory
genx deps --write

# Apply changes to a specific directory
genx deps ../my-package --write

# Sync all managed targets
genx deps --managed --write

# Include policy downgrades (dry run)
genx deps --allow-downgrade
```

### `genx features`

```bash
genx features [path] [options]
```

**Examples:**

```bash
# Add features to current directory
genx features

# Add the same features across managed targets
genx features --managed
```

<!-- GENERATED:USAGE:END -->

---

## ✨ Features

<!-- GENERATED:FEATURES:START -->

### oxc-config

Migrate an existing package to `oxfmt` + `oxlint` + `@finografic/oxc-config` (for repos not created from the latest genx template).

- Installs `oxfmt`, `oxlint`, and `@finografic/oxc-config`
- Creates `oxfmt.config.ts` and `oxlint.config.ts` (base presets; CSS overrides come from the **css** feature)
- Adds `format:check` / `format:fix`, `lint` / `lint:fix`, and `update:oxc-config` in the **PACKAGES** scripts section
- Replaces Prettier if present (uninstall + backup configs)
- Removes **dprint** / `@finografic/dprint-config` if still present (deps, `dprint.json(c)` / `dprint.config.jsonc`, lint-staged, scripts, VS Code `dprint.*` settings)
- Rewrites `.github/workflows/ci.yml` and `release.yml` so any `dprint` / `pnpm dprint check` steps use `pnpm format:check` instead
- Normalizes `lint-staged`: `*.{ts,…,cjs}` → `oxfmt` then `oxlint --fix`; `*.md` → `oxlint --fix` only; `*.{json,jsonc,md,yml,yaml,toml}` → `oxfmt` only (legacy data globs are merged)
- Adds format check to `release:check` / CI when missing
- Recommends `oxc.oxc-vscode`, marks the Prettier extension as unwanted
- Updates `.vscode/settings.json` with JSONC-aware patches (keeps `//` comments and unrelated keys): global oxc options sit just before `prettier.enable`; `[markdown]` is inserted before `markdownlint.config` when present
- **Legacy:** if `eslint.config.ts` exists, strips redundant `@stylistic/*` rules that oxfmt fully covers (ESLint is not installed by this feature)

### vitest

Testing via Vitest.

- Installs `vitest`
- Adds `test` / `test:run` / `test:coverage` scripts

### ai-instructions

Shared AI tooling instructions for GitHub Copilot, Cursor, and Claude Code.

- Syncs `.github/copilot-instructions.md` from `_templates` (full file when content differs).
- Syncs each file under `.github/instructions/` from `_templates`, **except** the `project/` subtree — that folder is never overwritten by genx (per-repo rules stay put).
- Syncs **`AGENTS.md`** with **reverse apply** from **`_templates/AGENTS.md.template`** (canonical spine: **Rules — Project-Specific** → **Rules — Global** → **Rules — Markdown Tables** → **Git Policy**, plus shared bodies for General / Markdown / Git). The target supplies **Rules — Project-Specific** body and any extra `##` sections; those land **after** the spine (merge order), with **Learned** last. Treat that template file as the spec — not the genx repo’s root `AGENTS.md`. Missing file: write the full template. Before merge, rewrites **legacy** `.github/instructions/NN-*.instructions.md` path strings (flat layout) and `project/NN-` prefixes to the current **code / naming / documentation / git** subfolder paths so old links in any section are updated.
- Optionally updates `eslint.config.ts` ignore patterns for `.cursor/` paths.

### markdown

Markdown linting via `@finografic/md-lint` (replaces legacy `eslint-plugin-markdownlint`).

- Installs `@finografic/md-lint`
- Normalizes `lint-staged` for `*.md`: `oxfmt` + `md-lint --fix` (migrates legacy `eslint --fix` on markdown when present)
- Removes legacy `eslint-plugin-markdownlint` / `eslint-plugin-simple-import-sort` from devDependencies when present
- Strips markdownlint-related blocks from **legacy** `eslint.config.*` when present
- Adds `lint:md` / `lint:md:fix` scripts
- Adds `markdownlint.config` to `.vscode/settings.json` (JSONC-aware merge — does not strip existing `//` comments in that block)
- Adds VSCode extension recommendation
- Uses styles from the `md-lint` package for markdown preview (removes copied `.vscode/*.css` when redundant)

### css

CSS / SCSS formatting via **oxc** (`oxfmt` presets) and **migration cleanup** of legacy Stylelint.

- Removes `stylelint` and `@stylistic/stylelint-plugin` from `package.json` when present
- Deletes `stylelint.config.ts` and `.stylelintrc.json` when present
- Strips Stylelint-related keys from `.vscode/settings.json` and removes the `stylelint.vscode-stylelint` recommendation from `.vscode/extensions.json`
- Restores VS Code built-in `css.validate` / `scss.validate` when they were set to `false` only for the old Stylelint workflow (removes the `false` entries)
- Configures **oxc.oxc-vscode** as the default formatter for `css` and `scss`
- Patches `oxfmt.config.ts`: adds the `css` preset import and `{ files: ['*.css', '*.scss'], options: { ...css } }` when missing

### git-hooks

Pre-commit linting + conventional commits.

- Installs `lint-staged`, `husky`
- Installs `@commitlint/cli`, `@commitlint/config-conventional`
- Adds `lint-staged` config to package.json (`*.{ts,tsx,js,jsx,mjs,cjs}` → `oxfmt` then `oxlint --fix`, matching the oxc template)
- Scaffolds `.husky/pre-commit` and `.husky/commit-msg`
- Ensures `commitlint.config.mjs` exists (copies from genx `_templates/` when missing)
- Removes an inlined `commitlint` key from package.json if present (config lives in `commitlint.config.mjs`)
- Removes legacy `simple-git-hooks` config/files when present
- Ensures `prepare` script runs `husky`

<!-- GENERATED:FEATURES:END -->

---

## 📦 What's Included

Every scaffolded package includes:

- `package.json` — configured with scope, name, and package type
- `tsconfig.json` — strict TypeScript config
- `tsdown.config.ts` — modern bundler setup
- `oxfmt.config.ts` and `oxlint.config.ts` — formatter + linter via `@finografic/oxc-config` presets (`oxfmt`, `oxlint`)
- `.gitignore`, `LICENSE`, `README.md`

Optional features (selected during `create`, or added via `migrate` / `features`):

- **oxc-config** — align an existing repo with the template oxfmt + oxlint stack (not offered on `create`; new packages already include the configs above)
- **vitest** — unit testing
- **git-hooks** — pre-commit linting + conventional commits
- **ai-instructions** — shared AI rules (Copilot, Cursor, Claude)
- **markdown** — markdown linting via `@finografic/md-lint`
- **css** — oxfmt for CSS/SCSS; removes legacy Stylelint from older repos

---

## 🏗️ Generated Structure

```
my-package/
├── src/
│   ├── index.ts
│   └── cli.ts              (cli type only)
├── package.json
├── tsconfig.json
├── tsdown.config.ts
├── oxfmt.config.ts
├── oxlint.config.ts
├── .gitignore
├── LICENSE
├── README.md
└── .github/                 (optional)
    ├── copilot-instructions.md
    └── instructions/
```

---

## 📋 Commands Reference

<!-- GENERATED:COMMANDS_REF:START -->

| Command         | Description                                  | Options                                              |
| --------------- | -------------------------------------------- | ---------------------------------------------------- |
| `create`        | Scaffold a new @finografic package           | Interactive prompts                                  |
| `migrate`       | Sync conventions to an existing package      | `--write`, `--only=<sections>`, `--managed`, `--yes` |
| `deps`          | Sync dependencies to @finografic/deps-policy | `--write`, `--managed`, `--yes`, `--allow-downgrade` |
| `features`      | Add optional features to an existing package | `--managed`, `--yes`                                 |
| `help`          | Show this help message                       | -                                                    |
| `--help` / `-h` | Show help (works with commands too)          | -                                                    |

See `genx <command> --help` for detailed usage.

<!-- GENERATED:COMMANDS_REF:END -->

---

## 🛠️ Development

```bash
git clone https://github.com/finografic/genx.git
pnpm install
pnpm build
pnpm test:run
```

### Testing the CLI locally

Link globally (recommended — rebuilds take effect immediately):

```bash
pnpm link
genx create
genx migrate --help

# When done:
pnpm unlink
```

Or run the built binary directly: `node dist/index.mjs create`

### Documentation

- [Developer Workflow](./docs/DEVELOPER_WORKFLOW.md)
- [Release Process](./docs/RELEASES.md)
- [GitHub Packages Setup](./docs/GITHUB_PACKAGES_SETUP.md)

---

## License

MIT © [finografic](https://github.com/finografic)
