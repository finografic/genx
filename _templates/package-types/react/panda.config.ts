import { createColorTokens } from '@finografic/design-system/palette';
import { designSystemPreset } from '@finografic/design-system/panda.preset';
import { defineConfig } from '@pandacss/dev';

export default defineConfig({
  preflight: false,
  presets: ['@pandacss/dev/presets', designSystemPreset],

  include: [
    './src/**/*.{ts,tsx}',
    './node_modules/@finografic/design-system/dist/**/*.recipe.js',
    './node_modules/@finografic/design-system/src/**/*.{ts,tsx}',
  ],
  exclude: [],

  jsxFramework: 'react',
  outdir: './styled-system',

  theme: {
    ...designSystemPreset.theme,
    extend: {
      tokens: {
        ...designSystemPreset.theme?.tokens,
        colors: createColorTokens({
          primary: 'oklch(55% 0.15 250)',
          secondary: 'oklch(45% 0.10 280)',
          default: 'oklch(60% 0.02 250)',
          grey: 'oklch(55% 0.01 250)',
          text: 'oklch(20% 0.005 260)',
        }),
      },
    },
  },

  syntax: 'object-literal',
});
