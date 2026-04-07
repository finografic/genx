# Husky local migration

This repo now uses `husky` locally instead of `simple-git-hooks`.

## What changed

- `package.json` now uses `"prepare": "husky"`
- the old top-level `"simple-git-hooks"` block is removed
- pre-commit now lives in `.husky/pre-commit`

## One-time refresh

If you already had the repo cloned before this change, run:

```bash
pnpm install
pnpm prepare
```

That installs Husky and re-writes the local Git hook wiring for this clone.

## Current pre-commit hook

```bash
pnpm exec lint-staged --allow-empty
```

## Follow-up

This change is local to this repo for now.

`_templates/` and the `git-hooks` feature can be migrated later in a separate pass.
