/**
 * VSCode configuration types.
 */

/**
 * VSCode extensions.json structure.
 */
export interface VSCodeExtensionsJson {
  recommendations?: string[];
  unwantedRecommendations?: string[];
}

/**
 * VSCode language-specific editor settings.
 */
export interface VSCodeLanguageSettings {
  'editor.defaultFormatter'?: string;
  'editor.codeActionsOnSave'?: Record<string, string>;
  'files.trimTrailingWhitespace'?: boolean;
  'files.insertFinalNewline'?: boolean;
}

/**
 * VSCode settings.json structure (partial - only what we care about).
 */
export interface VSCodeSettingsJson {
  'editor.codeActionsOnSave'?: Record<string, string>;
  'editor.formatOnSave'?: boolean;
  'eslint.enable'?: boolean;
  'eslint.useFlatConfig'?: boolean;
  'eslint.format.enable'?: boolean;
  'prettier.enable'?: boolean;
  'dprint.experimentalLsp'?: boolean;
  'dprint.verbose'?: boolean;
  'npm.packageManager'?: 'npm' | 'yarn' | 'pnpm';
  'markdownlint.config'?: Record<string, unknown>;
  // Language-specific settings (e.g., "[typescript]", "[javascript]")
  [key: `[${string}]`]: VSCodeLanguageSettings | undefined;
  // Allow other settings
  [key: string]: unknown;
}
