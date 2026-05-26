import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      'components': resolve('src/components'),
      'layout': resolve('src/layout'),
      'styles': resolve('src/styles'),
      'types': resolve('src/types'),
      'utils': resolve('src/utils'),
      '@styled-system/styles.css': resolve('styled-system/styles.css'),
      '@styled-system/css': resolve('styled-system/css'),
      '@styled-system/jsx': resolve('styled-system/jsx'),
    },
  },
});
