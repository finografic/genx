import type { TemplateVars } from 'types/template.types';

/**
 * Replace tokens in template content with actual values.
 *
 * Tokens follow the pattern: __UPPER_SNAKE_CASE__
 * The `**UPPER_SNAKE_CASE**` form is also matched — markdown linters running on template
 * files normalize underscore-emphasis to asterisk-emphasis (MD049), so both forms must work.
 *
 * @example
 *   applyTemplate('Hello __NAME__!', { NAME: 'World' }); // => "Hello World!"
 *   applyTemplate('# **PACKAGE_NAME**', { PACKAGE_NAME: 'foo' }); // => "# foo"
 */
export function applyTemplate(content: string, vars: TemplateVars): string {
  return content.replace(/(?:__|\*\*)([A-Z][A-Z_]*)(?:__|\*\*)/g, (match, key) => {
    if (key in vars) {
      return vars[key];
    }
    // Leave unmatched tokens as-is for debugging
    return match;
  });
}

/**
 * Build template variables from package config.
 */
export function buildTemplateVars(config: {
  name: string;
  scope: string;
  description: string;
  author: { name: string; email: string; url: string };
}): TemplateVars {
  const scopeWithAt = config.scope.startsWith('@') ? config.scope : `@${config.scope}`;
  return {
    NAME: config.name,
    SCOPE: scopeWithAt,
    PACKAGE_NAME: `${scopeWithAt}/${config.name}`,
    DESCRIPTION: config.description,
    AUTHOR_NAME: config.author.name,
    AUTHOR_EMAIL: config.author.email,
    AUTHOR_URL: config.author.url,
    YEAR: new Date().getFullYear().toString(),
  };
}
