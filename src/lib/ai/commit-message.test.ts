import { describe, expect, it } from 'vitest';

import {
  MAX_SUBJECT_LENGTH,
  cleanResponse,
  enforceHeaderShape,
  normalizeScope,
  selectModel,
} from './commit-message.js';

describe('normalizeScope', () => {
  it('reduces multi-word and CamelCase scopes to one lowercase word', () => {
    expect(normalizeScope('VaultBrowser')).toBe('vault');
    expect(normalizeScope('foo, bar')).toBe('foo');
    expect(normalizeScope('foo/bar')).toBe('foo');
  });

  it('keeps hyphenated names intact and drops unusable input', () => {
    expect(normalizeScope('nvm-autoload')).toBe('nvm-autoload');
    expect(normalizeScope('   ')).toBe('');
  });

  it('drops filenames entirely rather than using them as a scope', () => {
    expect(normalizeScope('.gitignore')).toBe('');
    expect(normalizeScope('package.json')).toBe('');
    expect(normalizeScope('README.md')).toBe('');
    expect(normalizeScope('vite.config.ts')).toBe('');
  });

  it('keeps the leading directory of a path as the scope', () => {
    expect(normalizeScope('docs/todo/ROADMAP.md')).toBe('docs');
    expect(normalizeScope('src/foo.ts')).toBe('src');
  });
});

describe('enforceHeaderShape', () => {
  it('moves a type written inside the parens to the front', () => {
    expect(enforceHeaderShape('(build): do the thing')).toBe('build: do the thing');
  });

  it('supplies chore when only a scope was given', () => {
    expect(enforceHeaderShape('(sidebar): do the thing')).toBe('chore(sidebar): do the thing');
  });

  it('maps near-miss type names onto allowed types', () => {
    expect(enforceHeaderShape('feature: do the thing')).toBe('feat: do the thing');
    expect(enforceHeaderShape('update(x): do the thing')).toBe('chore(x): do the thing');
  });

  it('strips a nested second header and a trailing period', () => {
    expect(enforceHeaderShape('feat(core): refactor(parse): improve x.')).toBe('feat(core): improve x');
  });

  it('leaves a subject containing an ordinary colon alone', () => {
    expect(enforceHeaderShape('feat(core): add support for x: y')).toBe('feat(core): add support for x: y');
  });

  it('drops a filename scope, leaving a bare type', () => {
    expect(enforceHeaderShape('chore(.gitignore): remove unnecessary entries')).toBe(
      'chore: remove unnecessary entries',
    );
    expect(enforceHeaderShape('docs(README.md): fix links')).toBe('docs: fix links');
  });

  it('does not mistake a filename scope for a missing type', () => {
    // The scope is dropped, but `feat` must survive rather than falling back to `chore`.
    expect(enforceHeaderShape('feat(package.json): add script')).toBe('feat: add script');
  });

  it('returns a message with no colon untouched', () => {
    expect(enforceHeaderShape('just a sentence')).toBe('just a sentence');
  });
});

describe('cleanResponse', () => {
  it('unwraps code fences, quotes, and a leading echo', () => {
    expect(cleanResponse('```\nfeat(cli): add flag\n```')).toBe('feat(cli): add flag');
    expect(cleanResponse('Commit message: feat(cli): add flag')).toBe('feat(cli): add flag');
    expect(cleanResponse('"feat(cli): add flag"')).toBe('feat(cli): add flag');
  });

  it('takes the first non-empty line only', () => {
    expect(cleanResponse('\n\nfeat(cli): add flag\nsome trailing prose')).toBe('feat(cli): add flag');
  });

  it('returns empty for empty input', () => {
    expect(cleanResponse('   \n  ')).toBe('');
  });

  it('truncates an overlong subject at a word boundary', () => {
    const long = `feat(cli): ${'word '.repeat(40).trim()}`;
    const cleaned = cleanResponse(long);
    const subject = cleaned.slice('feat(cli): '.length);

    expect(subject.length).toBeLessThanOrEqual(MAX_SUBJECT_LENGTH);
    expect(cleaned.endsWith('word')).toBe(true);
  });
});

describe('selectModel', () => {
  const installed = ['llama3.2:3b', 'qwen2.5-coder:3b'];

  it('prefers an installed explicit preference', () => {
    expect(selectModel(installed, 'llama3.2:3b')).toBe('llama3.2:3b');
  });

  it('falls back to preference order when the requested model is absent', () => {
    expect(selectModel(installed, 'not-installed:1b')).toBe('qwen2.5-coder:3b');
  });

  it('returns null when nothing is installed', () => {
    expect(selectModel([], undefined)).toBeNull();
  });
});
