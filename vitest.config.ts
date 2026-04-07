import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

/** Match `tsconfig.json` `paths` so feature modules resolve under Vitest. */
const tsconfigPathsAlias = {
  config: path.join(root, 'src/config'),
  commands: path.join(root, 'src/commands'),
  core: path.join(root, 'src/core'),
  features: path.join(root, 'src/features'),
  help: path.join(root, 'src/help'),
  lib: path.join(root, 'src/lib'),
  types: path.join(root, 'src/types'),
  utils: path.join(root, 'src/utils'),
  _templates: path.join(root, '_templates'),
} as const;

export default defineConfig({
  resolve: {
    alias: tsconfigPathsAlias,
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts', '**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
