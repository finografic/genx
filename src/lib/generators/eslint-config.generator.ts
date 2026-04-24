// DEPRECATED: ESLint config generation removed — oxlint replaces ESLint. This generator is unused;
// remove once the create command no longer references it.
export interface EslintConfigOptions {
  globals: Array<'node' | 'browser'>;
  markdown: boolean;
}

/**
 * Generate the full `eslint.config.ts` content based on package type settings and selected features.
 */
export function generateEslintConfig(options: EslintConfigOptions): string {
  const { globals: globalsPresets, markdown } = options;

  const imports = buildImports(markdown);
  const jsBlock = buildJsBlock(globalsPresets);
  const tsBlock = buildTsBlock(globalsPresets);
  const markdownBlock = markdown ? buildMarkdownBlock() : '';

  return [
    imports,
    '',
    'export default defineConfig([',
    '  globalIgnores([',
    "    '**/node_modules/**',",
    "    '**/dist/**',",
    "    '**/.cursor/hooks/**',",
    "    '**/.cursor/chats/**',",
    "    '**/.claude/**',",
    "    '**/*.min.*',",
    "    '**/*.map',",
    '  ]),',
    '',
    '  js.configs.recommended,',
    '',
    jsBlock,
    '',
    tsBlock,
    markdownBlock,
    ']);',
    '',
  ].join('\n');
}

function buildImports(markdown: boolean): string {
  const lines: string[] = [
    "import js from '@eslint/js';",
    "import stylistic from '@stylistic/eslint-plugin';",
  ];

  if (markdown) {
    lines.push("import type { Linter } from 'eslint';");
  }

  lines.push("import { defineConfig, globalIgnores } from 'eslint/config';");

  if (markdown) {
    lines.push(
      "import markdownlintPlugin from 'eslint-plugin-markdownlint';",
      "import markdownlintParser from 'eslint-plugin-markdownlint/parser.js';",
    );
  }

  lines.push("import globals from 'globals';", '', "import tseslint from 'typescript-eslint';");

  return lines.join('\n');
}

function buildGlobalsSpreads(presets: Array<'node' | 'browser'>): string {
  return presets.map((p) => `        ...globals.${p},`).join('\n');
}

function buildJsBlock(presets: Array<'node' | 'browser'>): string {
  const spreads = buildGlobalsSpreads(presets);

  return [
    '  {',
    "    files: ['**/*.{js,mjs,cjs}'],",
    '    languageOptions: {',
    "      ecmaVersion: 'latest',",
    "      sourceType: 'module',",
    '      globals: {',
    spreads,
    '      },',
    '    },',
    '  },',
  ].join('\n');
}

function buildTsBlock(presets: Array<'node' | 'browser'>): string {
  const spreads = buildGlobalsSpreads(presets);

  return [
    '  {',
    "    files: ['**/*.{ts,tsx}'],",
    '    languageOptions: {',
    "      ecmaVersion: 'latest',",
    "      sourceType: 'module',",
    '      parser: tseslint.parser,',
    '      parserOptions: {',
    "        ecmaVersion: 'latest',",
    "        sourceType: 'module',",
    '      },',
    '      globals: {',
    spreads,
    '      },',
    '    },',
    '    plugins: {',
    "      '@typescript-eslint': tseslint.plugin,",
    "      '@stylistic': stylistic,",
    '    },',
    '    rules: {',
    '      // Disable base rules in favor of TS-aware ones',
    "      'no-unused-vars': 'off',",
    "      'no-redeclare': 'off',",
    "      'no-console': 'off',",
    '',
    "      '@typescript-eslint/no-unused-vars': [",
    "        'error',",
    '        {',
    "          args: 'all',",
    "          argsIgnorePattern: '^_',",
    "          caughtErrors: 'all',",
    "          caughtErrorsIgnorePattern: '^_',",
    "          destructuredArrayIgnorePattern: '^_',",
    "          varsIgnorePattern: '^_',",
    '          ignoreRestSiblings: true,',
    '        },',
    '      ],',
    "      '@typescript-eslint/no-redeclare': 'warn',",
    '',
    "      '@stylistic/indent': ['warn', 2, { SwitchCase: 1, ignoredNodes: ['ConditionalExpression'] }],",
    "      '@stylistic/operator-linebreak': ['warn', 'after', { overrides: { '?': 'ignore', ':': 'ignore' } }],",
    "      '@stylistic/multiline-ternary': ['warn', 'always-multiline'],",
    '    },',
    '  },',
  ].join('\n');
}

function buildMarkdownBlock(): string {
  return [
    '',
    '  {',
    "    files: ['**/*.md'],",
    '    ignores: [',
    "      'node_modules/**',",
    "      'dist/**',",
    "      '.cursor/**',",
    '    ],',
    '    languageOptions: {',
    '      parser: markdownlintParser,',
    '    },',
    '    plugins: {',
    '      markdownlint: markdownlintPlugin as Linter.Processor,',
    "      '@stylistic': stylistic,",
    '    },',
    '    rules: {',
    '      ...markdownlintPlugin.configs.recommended.rules,',
    "      'markdownlint/md001': 'off', // heading increment",
    "      'markdownlint/md004': 'off', // Unordered list style",
    "      'markdownlint/md012': 'off', // Multiple consecutive blank lines",
    "      'markdownlint/md013': 'off', // Line length",
    "      'markdownlint/md024': 'off', // Duplicate headings",
    "      'markdownlint/md025': 'off', // Single h1",
    "      'markdownlint/md026': 'off', // Trailing punctuation in heading",
    "      'markdownlint/md029': 'off', // List style",
    "      'markdownlint/md036': 'off', // No emphasis as heading",
    "      'markdownlint/md040': 'off', // Fenced code language",
    "      'markdownlint/md041': 'off', // First line heading",
    "      'markdownlint/md043': 'off', // Required heading structure",
    "      'markdownlint/md045': 'off', // images require alt text",
    '',
    '      // Formatting consistency',
    "      '@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0, maxBOF: 0 }],",
    "      '@stylistic/no-trailing-spaces': 'error',",
    "      '@stylistic/no-multi-spaces': ['error', { exceptions: { Property: true } }],",
    '    },',
    '  },',
  ].join('\n');
}
