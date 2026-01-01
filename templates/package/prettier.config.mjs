const prettierDefaults = {
  arrowParens: 'always',
  bracketSameLine: false,
  bracketSpacing: true,
  cursorOffset: -1,
  embeddedLanguageFormatting: 'auto',
  endOfLine: 'lf',
  htmlWhitespaceSensitivity: 'css',
  insertPragma: false,
  jsxSingleQuote: false,
  printWidth: 80,
  proseWrap: 'preserve',
  quoteProps: 'as-needed',
  rangeEnd: Infinity,
  rangeStart: 0,
  requirePragma: false,
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: 'es5',
  useTabs: false,
  vueIndentScriptAndStyle: false,
  plugins: [],
  overrides: [],
};

const customOverrides = {
  printWidth: 110,
  singleQuote: true,
  trailingComma: 'all',
  quoteProps: 'consistent',
};

export default {
  ...prettierDefaults,
  ...customOverrides,
};
