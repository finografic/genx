export type VSCodeSettingsGroupId =
  | 'packageManager'
  | 'editorCore'
  | 'linting'
  | 'oxc'
  | 'typescript'
  | 'languageFormatters'
  | 'markdown';

export interface VSCodeSettingsGroupDefinition {
  id: VSCodeSettingsGroupId;
  keys: readonly string[];
}

export const VSCODE_BASE_LANGUAGE_ORDER = [
  'javascript',
  'typescript',
  'json',
  'jsonc',
  'yaml',
  'toml',
  'markdown',
] as const;

export const VSCODE_SETTINGS_GROUPS = [
  {
    id: 'packageManager',
    keys: ['npm.packageManager'],
  },
  {
    id: 'editorCore',
    keys: [
      'editor.formatOnSave',
      'editor.formatOnSaveMode',
      'editor.defaultFormatter',
      'editor.codeActionsOnSave',
    ],
  },
  {
    id: 'linting',
    keys: ['eslint.enable', 'prettier.enable'],
  },
  {
    id: 'oxc',
    keys: ['oxc.typeAware', 'oxc.lint.run'],
  },
  {
    id: 'typescript',
    keys: ['typescript.tsdk', 'typescript.preferences.preferTypeOnlyAutoImports'],
  },
  {
    id: 'languageFormatters',
    keys: [],
  },
  {
    id: 'markdown',
    keys: ['markdownlint.config', 'markdown.styles'],
  },
] as const satisfies readonly VSCodeSettingsGroupDefinition[];

export const VSCODE_SETTINGS_GROUP_KEY_SET: ReadonlySet<string> = new Set(
  VSCODE_SETTINGS_GROUPS.flatMap((group) => group.keys),
);

export function isVSCodeLanguageBlockKey(key: string): key is `[${string}]` {
  return key.startsWith('[') && key.endsWith(']');
}

export function languageBlockKey(language: string): `[${string}]` {
  return `[${language}]`;
}

export function collectVSCodeLanguageOrder(settings: Record<string, unknown>): string[] {
  return Object.keys(settings)
    .filter((key) => key.startsWith('[') && key.endsWith(']'))
    .map((key) => key.slice(1, -1));
}

export function insertLanguagesBefore(
  currentOrder: readonly string[],
  languages: readonly string[],
  beforeLanguage: string,
): string[] {
  const withoutInserted = currentOrder.filter((language) => !languages.includes(language));
  const insertAt = withoutInserted.indexOf(beforeLanguage);

  if (insertAt === -1) {
    return [
      ...withoutInserted,
      ...languages.filter((language, index) => languages.indexOf(language) === index),
    ];
  }

  return [
    ...withoutInserted.slice(0, insertAt),
    ...languages.filter((language, index) => languages.indexOf(language) === index),
    ...withoutInserted.slice(insertAt),
  ];
}
