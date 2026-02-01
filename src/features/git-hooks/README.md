# git-hooks

Pre-commit linting + conventional commits.

## What it does

- Installs `lint-staged`, `simple-git-hooks`
- Installs `@commitlint/cli`, `@commitlint/config-conventional`
- Adds `lint-staged` config to package.json
- Adds `simple-git-hooks` config to package.json
- Creates `commitlint.config.mjs`
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

1. **lint-staged**: runs `eslint --fix` on staged `.ts/.js` files
2. **commitlint**: validates commit messages (conventional format)
3. **simple-git-hooks**: wires up `.git/hooks/pre-commit`
