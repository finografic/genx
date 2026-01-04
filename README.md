# 🦋 @finografic/create

> Opinionated generator and codemod toolkit for the **@finografic** ecosystem.

This package provides a small CLI for:

- scaffolding new `@finografic` packages
- applying conventions (e.g. TypeScript) to existing repositories
- keeping project structure **consistent, minimal, and explicit**

It is designed to be **run**, not installed.

---

## ✨ Features

- 📦 Scaffold new `@finografic` packages
- 🎛 Interactive CLI powered by `@clack/prompts`
- 📐 Flat, modern tooling defaults (ESLint v9, pnpm, ESM)
- 🔧 Full TypeScript configuration
- ✅ Vitest for testing
- 🚀 GitHub release workflow
- 🤖 Optional AI rules (Copilot instructions)
- 🧠 No hidden lifecycle hooks or side effects

---

## 🚀 Usage

Run directly using `pnpm dlx`:

```bash
# Show help
pnpm dlx @finografic/create help
pnpm dlx @finografic/create --help

# Create a new package (interactive)
pnpm dlx @finografic/create create

# Migrate an existing package (dry-run by default)
pnpm dlx @finografic/create migrate
```

### Create Command

Scaffolds a new `@finografic` package interactively:

```bash
pnpm dlx @finografic/create create
```

The CLI will prompt you for:

1. Package scope (default: `finografic`)
2. Package name (e.g., `my-package`)
3. Package description
4. Author information (name, email, URL)
5. Optional features (AI rules, vitest, GitHub workflow)

Then it will:

- Create the project directory
- Copy and configure all template files
- Install dependencies
- Initialize git with an initial commit

### Migrate Command

Syncs conventions to an existing `@finografic` package. **Dry-run by default** - no files are modified unless `--write` is passed.

```bash
# Dry run in the current directory
pnpm dlx @finografic/create migrate

# Dry run against a target directory
pnpm dlx @finografic/create migrate ../some-repo

# Apply changes
pnpm dlx @finografic/create migrate ../some-repo --write

# Only update specific sections
pnpm dlx @finografic/create migrate --only=package-json,eslint --write

# Get help for migrate command
pnpm dlx @finografic/create migrate --help
```

**Available `--only` sections:**

- `package-json` - Update scripts, lint-staged, keywords
- `hooks` - Sync `.simple-git-hooks.mjs`
- `nvmrc` - Sync `.nvmrc` (Node version)
- `eslint` - Sync `eslint.config.ts`
- `workflows` - Sync `.github/workflows/release.yml`
- `docs` - Sync `docs/` directory

**What gets migrated:**

- Package.json scripts (test, lint, release, etc.)
- lint-staged configuration
- Keywords (ensures `finografic` and package name)
- Git hooks configuration
- Node version (`.nvmrc`)
- ESLint configuration
- GitHub release workflow
- Documentation files

---

## 📦 What's Included

Every generated package includes:

### Core Files

- `package.json` - Configured with your scope and name
- `tsconfig.json` - Strict TypeScript config
- `tsdown.config.ts` - Modern bundler setup
- `.gitignore` - Sensible defaults
- `LICENSE` - MIT license
- `README.md` - Basic documentation template

### Development Tools

- **ESLint** - Modern flat config (v9)
- **Prettier** - Code formatting
- **Commitlint** - Conventional commits
- **simple-git-hooks** - Pre-commit hooks
- **lint-staged** - Run linters on staged files

### Optional Features

- **Vitest** - Fast unit testing (recommended)
- **GitHub Workflow** - Automated releases
- **AI Rules** - Copilot instructions and guidelines

---

## 🏗️ Generated Structure

```
my-package/
├── .github/
│   ├── workflows/
│   │   └── release.yml
│   ├── copilot-instructions.md  (optional)
│   └── instructions/            (optional)
├── src/
│   └── index.ts
├── package.json
├── tsconfig.json
├── eslint.config.ts
├── prettier.config.mjs
├── commitlint.config.mjs
├── .simple-git-hooks.mjs
├── .gitignore
├── LICENSE
└── README.md
```

---

## 📋 Commands Reference

| Command          | Description                          | Options                        |
| ---------------- | ------------------------------------ | ------------------------------ |
| `create`         | Scaffold a new @finografic package   | Interactive prompts            |
| `migrate [path]` | Sync conventions to existing package | `--write`, `--only=<sections>` |
| `help`           | Show help message                    | -                              |
| `--help` / `-h`  | Show help (works with commands too)  | -                              |

See `finografic-create <command> --help` for detailed usage.

---

## 🛠️ Development

```bash
# Clone the repo
git clone https://github.com/finografic/create.git

# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test.run
```

### Testing the CLI Locally

#### Option 1: Link Globally (Recommended)

Link the built package globally so you can use `finografic-create` from anywhere:

```bash
# Build and link globally
pnpm link

# Now you can use it from anywhere:
finografic-create create
finografic-create migrate --help
finografic-create help

# When done testing, unlink:
pnpm unlink
```

**Note:** After making changes, rebuild with `pnpm build` and the linked version will automatically use the new build.

#### Option 2: Direct Node Execution

Run the built binary directly:

```bash
# Build first
pnpm build

# Test create (will prompt interactively)
node dist/index.mjs create

# Test migrate (dry-run) in current directory
node dist/index.mjs migrate

# Test migrate (dry-run) against another repo
node dist/index.mjs migrate ../@finografic-core

# Test migrate with --write (be careful!)
node dist/index.mjs migrate ../@finografic-core --write

# Test migrate with --only flag
node dist/index.mjs migrate ../@finografic-core --only=package-json --write

# Test help system
node dist/index.mjs help
node dist/index.mjs --help
node dist/index.mjs create --help
node dist/index.mjs migrate --help
```

#### Option 3: Using pnpm dlx

You can also use `pnpm dlx` from the project root:

```bash
pnpm dlx @finografic/create create
```

**Note:** `pnpm link` is the fastest for iteration since you only need to rebuild after changes.

### Documentation

- [Developer Workflow](./docs/DEVELOPER_WORKFLOW.md) - Daily development and testing workflow
- [Release Process](./docs/RELEASES.md) - How to cut releases
- [GitHub Packages Setup](./docs/GITHUB_PACKAGES_SETUP.md) - Publishing and consuming packages

---

## License

MIT © [finografic](https://github.com/finografic)
