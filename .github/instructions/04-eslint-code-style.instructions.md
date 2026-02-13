# ESLint & Code Style Rules

## Import Sorting

- Use `simple-import-sort` and group imports logically (external → internal → relative → side-effects)
  separated by blank lines.
- Prefer auto-fix via ESLint; avoid manual reordering.

## JSX Formatting

- Let Prettier control parentheses and multiline formatting; avoid manual tweaks.

## Fixing

```bash
npm run lint.fix -- path/to/file.tsx
npm run lint.fix -- "src/**/*.tsx"
npm run lint -- path/to/file.tsx
```

## dprint

- Always use `--allow-no-files` when running `dprint check` or `dprint fmt` on specific paths (some paths may be excluded by config).

## Known Warnings (ignore)

- `[@stylistic/eslint-plugin]: You are using deprecated options("overrides.arrow") in "type-annotation-spacing"` — WIP migration, ignore this warning.

## Disabled Rules (intentional)

- `style/jsx-wrap-multilines`, `react/jsx-wrap-multilines` (Prettier governs formatting)
- `ts/no-unused-vars` in favor of import cleanup
