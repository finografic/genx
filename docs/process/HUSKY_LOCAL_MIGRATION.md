# Husky local migration

This repo now uses `husky` locally instead of `simple-git-hooks`.

## What changed

- `package.json` now uses `"prepare": "husky"`
- the old top-level `"simple-git-hooks"` block is removed
- pre-commit now lives in `.husky/pre-commit`
- commit message validation now lives in `.husky/commit-msg`

## One-time refresh

If you already had the repo cloned before this change, run:

```bash
pnpm install
pnpm prepare
```

That installs Husky and re-writes the local Git hook wiring for this clone.

## Current hooks

### Pre-commit

```bash
pnpm exec lint-staged --allow-empty
```

### Commit-msg

```bash
pnpm exec commitlint --edit "$1"
```

## Follow-up

This repo, `_templates/`, and the `git-hooks` feature now use the same Husky shape.
