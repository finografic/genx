# React + Vite

Ensures a Vite + React + TypeScript app surface is fully configured with Panda CSS,
`@finografic/design-system`, and path aliases.

## What it does

- Ensures `react`, `react-dom`, `@finografic/design-system`, and `@finografic/icons` are
  in `dependencies`
- Ensures `vite`, `@vitejs/plugin-react`, `@pandacss/dev`, `concurrently`, and React type
  packages are in `devDependencies`
- Creates `vite.config.ts` with React plugin and path aliases when missing
- Creates `panda.config.ts` with design-system preset when missing
- Creates `postcss.config.mjs` with Panda CSS plugin when missing
- Creates `src/vite-env.d.ts`, `src/main.tsx`, and `src/App.tsx` when missing

## Files

| File                      | Purpose                                       |
| ------------------------- | --------------------------------------------- |
| `react-vite.constants.ts` | Package names, versions, file paths           |
| `react-vite.detect.ts`    | Checks if feature is already fully configured |
| `react-vite.feature.ts`   | Feature definition and metadata               |
| `react-vite.preview.ts`   | Preview-driven diff generation                |
| `react-vite.apply.ts`     | Applies preview changes + runs pnpm install   |
