import type { TemplateVars } from 'types/template.types';

/**
 * Build the default template variable set used when copying feature templates.
 * All string vars default to empty; YEAR is computed at call time.
 */
export function createDefaultTemplateVars(): TemplateVars {
  return {
    SCOPE: '',
    NAME: '',
    PACKAGE_NAME: '',
    YEAR: new Date().getFullYear().toString(),
    DESCRIPTION: '',
    AUTHOR_NAME: '',
    AUTHOR_EMAIL: '',
  };
}
