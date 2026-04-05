# ESLint & Code Style Rules

## Import Sorting

- Prefer auto-fix via ESLint; avoid manual reordering.

## JSX Formatting

- Let Prettier control parentheses and multiline formatting; avoid manual tweaks.

## Fixing

```bash
npm run lint:fix -- path/to/file.tsx
npm run lint:fix -- "src/**/*.tsx"
npm run lint -- path/to/file.tsx
```

## Disabled Rules (intentional)

- `style/jsx-wrap-multilines`, `react/jsx-wrap-multilines` (Prettier governs formatting)
- `ts/no-unused-vars` in favor of import cleanup
