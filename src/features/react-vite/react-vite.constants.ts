/**
 * React + Vite feature constants.
 */

export const REACT_VITE_PRIMARY_PACKAGE = 'vite';
export const REACT_PACKAGE = 'react';
export const VITE_PLUGIN_REACT_PACKAGE = '@vitejs/plugin-react';
export const PANDACSS_DEV_PACKAGE = '@pandacss/dev';

export const REACT_VITE_CONFIG_FILE = 'vite.config.ts';
export const PANDA_CONFIG_FILE = 'panda.config.ts';
export const POSTCSS_CONFIG_FILE = 'postcss.config.mjs';
export const VITE_ENV_DTS_FILE = 'src/vite-env.d.ts';
export const MAIN_TSX_FILE = 'src/main.tsx';
export const APP_TSX_FILE = 'src/App.tsx';

export const REACT_RUNTIME_DEPS: Record<string, string> = {
  'react': '^19.2.0',
  'react-dom': '^19.2.0',
  '@finografic/design-system': '^1.18.2',
  '@finografic/icons': '^1.18.2',
};

export const REACT_DEV_DEPS: Record<string, string> = {
  '@pandacss/dev': '^1.11.1',
  '@types/react': '^19.2.2',
  '@types/react-dom': '^19.2.2',
  '@vitejs/plugin-react': '^5.1.0',
  'concurrently': '^9.2.1',
  'vite': '^7.1.10',
};

/**
 * DOM test environment for frontend packages. Declared here rather than in deps-policy because
 * `react` has no policy group — see `src/config/policy.ts`. The `vitest` feature adds it alongside
 * the react `vitest.config.ts`, which sets `environment: 'happy-dom'`.
 */
export const HAPPY_DOM_PACKAGE = 'happy-dom';
export const HAPPY_DOM_PACKAGE_VERSION = '^20.11.2';
