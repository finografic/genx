# git-hooks

Pre-commit linting + conventional commits.

## What it does

- Installs `lint-staged`, `husky`
- Installs `@commitlint/cli`, `@commitlint/config-conventional`
- Adds `lint-staged` config to package.json (`*.{ts,tsx,js,jsx,mjs,cjs}` → `eslint --fix`; the **oxfmt** feature prepends `oxfmt` when applied)
- Scaffolds `.husky/pre-commit` and `.husky/commit-msg`
- Ensures `commitlint.config.mjs` exists (copies from genx `_templates/` when missing)
- Removes an inlined `commitlint` key from package.json if present (config lives in `commitlint.config.mjs`)
- Removes legacy `simple-git-hooks` config/files when present
- Ensures `prepare` script runs `husky`

## Files

| File                     | Purpose                        |
| ------------------------ | ------------------------------ |
| `git-hooks.constants.ts` | Package names, configs         |
| `git-hooks.detect.ts`    | Check if lint-staged installed |
| `git-hooks.apply.ts`     | Install + configure            |
| `git-hooks.feature.ts`   | Feature definition             |

## Post-install

Run `pnpm prepare` to activate git hooks.

## How it works

1. **lint-staged**: runs `eslint --fix` on staged `*.{ts,tsx,js,jsx,mjs,cjs}` (and `oxfmt` first when the oxfmt feature is applied)
2. **Husky pre-commit**: runs `pnpm exec lint-staged --allow-empty`
3. **commitlint**: reads rules from `commitlint.config.mjs` and is invoked by `.husky/commit-msg`
