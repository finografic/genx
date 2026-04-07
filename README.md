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
genx migrate --only=package-json,eslint --write

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

### oxfmt

Migrate an existing package to `oxfmt` + `@finografic/oxfmt-config` (for repos not created from the latest genx template).

- Installs `oxfmt` and `@finografic/oxfmt-config`
- Creates `oxfmt.config.ts` (base preset; CSS overrides come from the **css** feature)
- Adds `format:check` / `format:fix` and `update:oxfmt-config` in the **PACKAGES** scripts section
- Replaces Prettier if present (uninstall + backup configs)
- Removes **dprint** / `@finografic/dprint-config` if still present (deps, `dprint.json(c)` / `dprint.config.jsonc`, lint-staged, scripts, VS Code `dprint.*` settings)
- Rewrites `.github/workflows/ci.yml` and `release.yml` so any `dprint` / `pnpm dprint check` steps use `pnpm format:check` instead
- Normalizes `lint-staged`: `*.{ts,…,cjs}` → `oxfmt` then `eslint --fix`; `*.md` → `eslint --fix` only; `*.{json,jsonc,md,yml,yaml,toml}` → `oxfmt` only (legacy data globs are merged)
- Adds format check to `release:check` / CI when missing
- Recommends `oxc.oxc-vscode`, marks the Prettier extension as unwanted
- Updates `.vscode/settings.json` with JSONC-aware patches (keeps `//` comments and unrelated keys): global oxc options sit just before `prettier.enable`; `[markdown]` is inserted before `markdownlint.config` when present
- Strips redundant `@stylistic/*` rules from `eslint.config.ts` that oxfmt fully covers

### vitest

Testing via Vitest.

- Installs `vitest`
- Adds `test` / `test:run` / `test:coverage` scripts

### ai-instructions

Shared AI tooling instructions for GitHub Copilot, Cursor, and Claude Code.

- Creates `.github/copilot-instructions.md` — summary index for GitHub Copilot
- Creates `.github/instructions/` — canonical rule files shared across all AI tools
- Creates `.github/instructions/project/` — empty folder for project-specific rules

### markdown

Markdown linting via `eslint-plugin-markdownlint`.

- Installs `eslint-plugin-markdownlint`
- When needed, splits a combined `*.{json,…,md}` oxfmt glob into data-only + `*.md` with `eslint --fix` only (oxfmt for `*.md` still runs via the data glob that includes `md`)
- Adds markdown block to `eslint.config.ts`
- Adds `markdownlint.config` to `.vscode/settings.json` (JSONC-aware merge — does not strip existing `//` comments in that block)
- Adds VSCode extension recommendation
- Copies `markdown-github-light.css`, `markdown-custom-dark.css`, for preview styling

### css

CSS linting via `stylelint` + `@stylistic/stylelint-plugin`.

- Installs `stylelint` and `@stylistic/stylelint-plugin`
- Creates `stylelint.config.ts` with stylistic indentation/spacing rules (`satisfies Config`)
- Enables stylelint in `.vscode/settings.json` (disables built-in `css.validate`)
- Configures oxfmt (oxc) as the default formatter for `css` and `scss`
- Patches `oxfmt.config.ts`: adds `css` import and `{ files: ['*.css', '*.scss'], options: { ...css } }` when missing (standard genx layout)
- Adds VSCode extension recommendation

### git-hooks

Pre-commit linting + conventional commits.

- Installs `lint-staged`, `husky`
- Installs `@commitlint/cli`, `@commitlint/config-conventional`
- Adds `lint-staged` config to package.json (`*.{ts,tsx,js,jsx,mjs,cjs}` → `eslint --fix`; the **oxfmt** feature prepends `oxfmt` when applied)
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
- `eslint.config.ts` — ESLint v9 flat config
- `.gitignore`, `LICENSE`, `README.md`

Optional features (selected during `create` or added via `features`):

- **oxfmt** — migrate older repos to oxfmt + `@finografic/oxfmt-config`
- **vitest** — unit testing
- **git-hooks** — pre-commit linting + conventional commits
- **ai-instructions** — shared AI rules (Copilot, Cursor, Claude)
- **markdown** — markdown linting via ESLint
- **css** — CSS linting via Stylelint + Stylistic plugin

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
├── eslint.config.ts
├── .gitignore
├── LICENSE
├── README.md
├── oxfmt.config.ts          (optional migration feature)
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
