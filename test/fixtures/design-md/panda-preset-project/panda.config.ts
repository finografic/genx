// Fixture: a config whose own theme is nearly empty — every design decision
// arrives through `presets`. The string preset must be reported, not resolved.
import preset from './panda.preset.js';

const config = {
  presets: ['@pandacss/preset-panda', preset],
  theme: {
    // Config-level theme wins over the preset for the same token.
    tokens: {
      radii: {
        md: { value: '0.75rem' },
      },
    },
  },
};

export default config;
