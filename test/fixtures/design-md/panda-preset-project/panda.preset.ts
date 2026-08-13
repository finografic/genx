// Fixture: a shared preset holding the real design decisions, as a design-system
// package exports it. Mirrors the shape found piloting against
// @finografic/design-system: DEFAULT keys, color-mix shade ramps, a bare `0` radius.
const preset = {
  name: 'fixture-preset',
  theme: {
    tokens: {
      colors: {
        primary: {
          DEFAULT: { value: 'oklch(48.8% 0.243 264.376)' },
          light: { value: 'color-mix(in oklch, oklch(48.8% 0.243 264.376) 82%, white)' },
          dark: { value: 'color-mix(in oklch, oklch(48.8% 0.243 264.376) 82%, black)' },
        },
      },
      radii: {
        none: { value: '0' },
        md: { value: '0.5rem' },
      },
      spacing: {
        0: { value: '0' },
        4: { value: '1rem' },
      },
    },
    semanticTokens: {
      colors: {
        surface: { value: { base: '#ffffff', _dark: '#0b1326' } },
        accent: { value: '{colors.primary.DEFAULT}' },
      },
    },
    textStyles: {
      body: {
        value: { fontSize: '1rem', lineHeight: 1.5 },
      },
    },
  },
};

export default preset;
