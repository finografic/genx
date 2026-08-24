import { describe, expect, it } from 'vitest';

import { addScriptInSection, getCanonicalScriptSections } from './script-sections.utils.js';

describe('getCanonicalScriptSections', () => {
  it('reads each script section from the template rather than a restated map', () => {
    const sections = getCanonicalScriptSections();

    expect(sections['link']).toBe('DEV_AND_BUILD');
    expect(sections['unlink']).toBe('DEV_AND_BUILD');
    // `prepack` and `prepare` really do live under UTILS in the template.
    expect(sections['prepack']).toBe('UTILS');
    expect(sections['typecheck']).toBe('UTILS');
    expect(sections['lint']).toBe('LINTING');
  });

  it('does not treat a script name as a section heading', () => {
    const sections = getCanonicalScriptSections();

    expect(Object.keys(sections)).not.toContain('DEV_AND_BUILD');
    expect(sections['lint:fix']).toBe('LINTING');
  });
});

describe('addScriptInSection', () => {
  // Divider characters have drifted between repositories, so the heading is matched by name.
  const scripts = {
    '————————— DEV_AND_BUILD': '—————————',
    'dev': 'vite',
    'build': 'vite build',
    '·········· UTILS': '··········',
    'typecheck': 'tsc',
  };

  it('places a script at the end of its own section, not at the end of the file', () => {
    const next = addScriptInSection(scripts, 'link', 'pnpm build && pnpm add -g .', 'DEV_AND_BUILD');

    expect(Object.keys(next)).toEqual([
      '————————— DEV_AND_BUILD',
      'dev',
      'build',
      'link',
      '·········· UTILS',
      'typecheck',
    ]);
  });

  it('appends when the target has no such section', () => {
    const next = addScriptInSection(scripts, 'test', 'vitest', 'TESTING');

    expect(Object.keys(next).at(-1)).toBe('test');
  });

  it('appends when the script has no canonical section', () => {
    const next = addScriptInSection(scripts, 'custom', 'echo hi', undefined);

    expect(Object.keys(next).at(-1)).toBe('custom');
  });

  it('appends when the target uses no section headings at all', () => {
    const flat = { dev: 'vite' };

    expect(addScriptInSection(flat, 'link', 'x', 'DEV_AND_BUILD')).toEqual({ dev: 'vite', link: 'x' });
  });
});
