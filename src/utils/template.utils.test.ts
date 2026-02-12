import { describe, expect, it } from 'vitest';

import { applyTemplate, buildTemplateVars } from './template.utils';

describe('template utils', () => {
  describe('applyTemplate', () => {
    it('should replace tokens with values', () => {
      const template = 'Hello __NAME__!';
      const vars = { NAME: 'World' };

      const result = applyTemplate(template, vars);

      expect(result).toBe('Hello World!');
    });

    it('should replace multiple tokens', () => {
      const template = '__SCOPE__/__NAME__ - __DESCRIPTION__';
      const vars = {
        SCOPE: '@finografic',
        NAME: 'test-package',
        DESCRIPTION: 'A test package',
      };

      const result = applyTemplate(template, vars);

      expect(result).toBe('@finografic/test-package - A test package');
    });

    it('should leave unmatched tokens as-is', () => {
      const template = 'Hello __NAME__! __MISSING__';
      const vars = { NAME: 'World' };

      const result = applyTemplate(template, vars);

      expect(result).toBe('Hello World! __MISSING__');
    });

    it('should handle empty template', () => {
      const result = applyTemplate('', {});

      expect(result).toBe('');
    });
  });

  describe('buildTemplateVars', () => {
    it('should build vars from config', () => {
      const config = {
        name: 'my-package',
        scope: '@finografic',
        description: 'My cool package',
        author: {
          name: 'Justin',
          email: 'justin@example.com',
          url: 'https://github.com/finografic',
        },
      };

      const vars = buildTemplateVars(config);

      expect(vars.NAME).toBe('my-package');
      expect(vars.SCOPE).toBe('@finografic');
      expect(vars.PACKAGE_NAME).toBe('@finografic/my-package');
      expect(vars.DESCRIPTION).toBe('My cool package');
      expect(vars.AUTHOR_NAME).toBe('Justin');
      expect(vars.AUTHOR_EMAIL).toBe('justin@example.com');
      expect(vars.AUTHOR_URL).toBe('https://github.com/finografic');
      expect(vars.YEAR).toBe(new Date().getFullYear().toString());
    });
  });
});
