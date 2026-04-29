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

| Command    | Description                                        |
| ---------- | -------------------------------------------------- |
| `create`   | Scaffold a new @finografic package                 |
| `migrate`  | Sync conventions to an existing package            |
| `deps`     | Sync dependencies to @finografic/deps-policy       |
| `features` | Add optional features to an existing package       |
| `audit`    | Scan features and apply what is missing or partial |
| `help`     | Show this help message                             |

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
genx migrate --only=package-json,oxc-config --write

# Update dependencies and Node version
genx migrate --only=dependencies,node --write

# Normalize file names and merge configs
genx migrate --only=renames,merges --write

# Migrate all managed targets
genx migrate --managed --write
```

### `genx deps`

```bash
genx deps [path] [--update-policy] [options]
```

**Examples:**

```bash
# Interactive sync in current directory (select packages to apply)
genx deps

# Interactive sync for a specific directory
genx deps ../my-package

# Apply all planned changes without multiselect (CI / non-interactive)
genx deps --yes

# Sync all managed targets (prompt per target unless --yes)
genx deps --managed

# Include policy downgrades when planning changes
genx deps --allow-downgrade

# Update deps-policy interactively (no dep sync)
genx deps --update-policy
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

### AI Agents (AGENTS.md + skills)

Scaffolds and syncs the agent interface layer of a `@finografic` project.

- Creates `AGENTS.md` from the canonical template if absent
- Keeps three enforced sections in sync with the template: **Rules — Global**,
- Seeds **Rules — Project-Specific** once (never overwritten — project customises it)
- Copies agent skill procedures into `.github/skills/` (scaffold-cli-help,

### ai-claude

Claude Code support: CLAUDE.md, session memory, handoff document, and settings.

- Creates `CLAUDE.md` — project-specific instructions for Claude Code
- Creates `.claude/memory.md` — session breadcrumb log (gitignored)
- Creates `.agents/handoff.md` — project snapshot for bridging Claude Code ↔ Claude.ai (gitignored)
- Creates `.claude/settings.json` — Claude Code permissions (checked in)
- Creates `.claude/assets/.gitkeep` — keeps the shared Claude assets area scaffolded even when empty
- Adds `.claude/` to `.gitignore`, re-admitting `settings.json`
- Auto-installs `ai-instructions` if `.github/instructions/` is missing

### ai-instructions

Shared AI tooling instructions for GitHub Copilot, Cursor, and Claude Code.

- Syncs `.github/copilot-instructions.md` from `_templates` (full file when content differs).
- Syncs each file under `.github/instructions/` from `_templates`, **except** the `project/` subtree — that folder is never overwritten by genx (per-repo rules stay put).
- Syncs **`AGENTS.md`** with **reverse apply** from **`_templates/AGENTS.md.template`** (canonical spine: **Rules — Project-Specific** → **Rules — Global** → **Rules — Markdown Tables** → **Git Policy**, plus shared bodies for General / Markdown / Git). The target supplies **Rules — Project-Specific** body and any extra `##` sections; those land **after** the spine (merge order), with **Learned** last. Treat that template file as the spec — not the genx repo’s root `AGENTS.md`. Missing file: write the full template.
- Optionally updates `eslint.config.ts` ignore patterns for `.cursor/` paths.

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

### markdown

Markdown linting via `eslint-plugin-markdownlint`.

- Installs `eslint-plugin-markdownlint`
- When needed, splits a combined `*.{json,…,md}` oxfmt glob into data-only + `*.md` with `eslint --fix` only (oxfmt for `*.md` still runs via the data glob that includes `md`)
- Adds markdown block to `eslint.config.ts`
- Adds `markdownlint.config` to `.vscode/settings.json` (JSONC-aware merge — does not strip existing `//` comments in that block)
- Adds VSCode extension recommendation
- Copies `markdown-github-light.css`, `markdown-custom-dark.css`, for preview styling

### oxc-config

Migrate an existing package to `@finografic/oxc-config` + `oxfmt` + `oxlint` (for repos not created from the latest genx template).

- Installs `oxfmt`, `oxlint`, `oxlint-tsgolint`, and `@finografic/oxc-config`
- Removes legacy `@finografic/oxfmt-config` if present
- Creates `oxfmt.config.ts` (base preset; CSS overrides come from the **css** feature)
- Ensures `lint` / `lint:fix` / `lint:ci` scripts use oxlint
- Creates or updates `update:oxc-config` in the **PACKAGES** scripts section
- Adds `format:check` / `format:fix` scripts
- Removes legacy update scripts (`update:eslint-config`, `update:oxfmt-config`)
- Replaces Prettier if present (uninstall + remove configs)
- Removes **dprint** / `@finografic/dprint-config` if still present (deps, config files, lint-staged, scripts)
- Rewrites `.github/workflows/ci.yml` and `release.yml` so any `dprint` steps use `pnpm format:check` instead
- Normalizes `lint-staged`: code → `oxfmt` then `oxlint --fix`; `*.md` → `oxfmt` then `oxlint --fix`; data files → `oxfmt` only
- Adds format check to `release:check` / CI when missing
- Removes the ESLint/`@stylistic`/`globals` package stack and `eslint.config.*` files
- Recommends `oxc.oxc-vscode`, removes legacy `dprint.dprint` / `dbaeumer.vscode-eslint` recommendations
- Writes canonical `.vscode/settings.json` (oxc formatter, all language blocks, oxc/typescript preferences)

### vitest

Testing via Vitest.

- Installs `vitest`
- Adds `test` / `test:run` / `test:coverage` scripts

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

| Command         | Description                                        | Options                                                      |
| --------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| `create`        | Scaffold a new @finografic package                 | Interactive prompts                                          |
| `migrate`       | Sync conventions to an existing package            | `--write`, `--only=<sections>`, `--managed`, `--yes`         |
| `deps`          | Sync dependencies to @finografic/deps-policy       | `--managed`, `--yes`, `--allow-downgrade`, `--update-policy` |
| `features`      | Add optional features to an existing package       | `--managed`, `--yes`                                         |
| `audit`         | Scan features and apply what is missing or partial | -                                                            |
| `help`          | Show this help message                             | -                                                            |
| `--help` / `-h` | Show help (works with commands too)                | -                                                            |

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
