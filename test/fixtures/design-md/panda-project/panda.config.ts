// Fixture: plain object export (defineConfig is identity at runtime; avoiding
// the @pandacss/dev import keeps the fixture installable-dependency-free).
const config = {
  theme: {
    tokens: {
      colors: {
        primary: { value: '#1a1c1e' },
        brand: {
          500: { value: '#2665fd' },
          600: { value: '#1e52d4' },
        },
      },
      radii: {
        sm: { value: '4px' },
        md: { value: '8px' },
      },
      spacing: {
        sm: { value: '8px' },
        md: { value: '16px' },
      },
    },
    semanticTokens: {
      colors: {
        surface: { value: { base: '#ffffff', _dark: '#0b1326' } },
        accent: { value: '{colors.brand.500}' },
      },
    },
    textStyles: {
      body: {
        md: {
          value: {
            fontFamily: 'Inter',
            fontSize: '16px',
            fontWeight: 400,
            lineHeight: 1.6,
          },
        },
      },
    },
  },
};

export default config;
