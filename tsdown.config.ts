import { defineConfig } from 'tsdown';

export default defineConfig({
  exports: true,
  entry: {
    index: 'src/cli.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'esnext',
});
