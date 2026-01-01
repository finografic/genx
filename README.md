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
pnpm dlx @finografic/create
```

The CLI will interactively prompt you for:

1. Package scope (e.g., `finografic`)
2. Package name (e.g., `my-package`)
3. Package description
4. Author information
5. Optional features (AI rules, vitest, GitHub workflow)

Then it will:

- Create the project directory
- Copy and configure all template files
- Install dependencies
- Initialize git with an initial commit

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
- **simple-git-hooks** - Pre-commit and pre-push hooks
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
├── eslint.config.mjs
├── prettier.config.mjs
├── commitlint.config.mjs
├── .simple-git-hooks.mjs
├── .gitignore
├── LICENSE
└── README.md
```

---

## 🔮 Future Features

- `apply typescript` - Add TypeScript to existing JS packages
- `apply testing` - Add vitest to existing packages
- More template types

---

## 🛠️ Development

```bash
# Clone the repo
git clone https://github.com/finografic/create.git

# Install dependencies
pnpm install

# Build
pnpm build

# Test locally
node dist/index.mjs
```

---

## License

MIT © [finografic](https://github.com/finografic)
