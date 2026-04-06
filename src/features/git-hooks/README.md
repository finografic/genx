# git-hooks

Pre-commit linting + conventional commits.

## What it does

- Installs `lint-staged`, `simple-git-hooks`
- Installs `@commitlint/cli`, `@commitlint/config-conventional`
- Adds `lint-staged` config to package.json (`*.{ts,tsx,js,jsx,mjs,cjs}` → `eslint --fix`; the **oxfmt** feature prepends `oxfmt` when applied)
- Adds `simple-git-hooks` config to package.json
- Ensures `commitlint.config.mjs` exists (copies from genx `_templates/` when missing)
- Removes an inlined `commitlint` key from package.json if present (config lives in `commitlint.config.mjs`)
- Ensures `prepare` script runs `simple-git-hooks`

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
2. **commitlint**: reads rules from `commitlint.config.mjs` at the repo root (add a **commit-msg** hook separately if you want validation on every commit; see `docs/process/DEVELOPER_WORKFLOW.md`)
3. **simple-git-hooks**: wires up `.git/hooks/pre-commit`
