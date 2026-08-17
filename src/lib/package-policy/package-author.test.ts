import { describe, expect, it } from 'vitest';

import { parsePackageAuthor } from './package-json.utils.js';

describe('parsePackageAuthor', () => {
  it('reads the object form', () => {
    expect(parsePackageAuthor({ author: { name: 'Justin Rankin', email: 'j@example.com' } })).toEqual({
      name: 'Justin Rankin',
      email: 'j@example.com',
    });
  });

  it('ignores extra fields on the object form', () => {
    expect(
      parsePackageAuthor({ author: { name: 'Justin Rankin', email: 'j@example.com', url: 'https://x' } }),
    ).toEqual({ name: 'Justin Rankin', email: 'j@example.com' });
  });

  it('reads the string form with email and url', () => {
    expect(parsePackageAuthor({ author: 'Justin Rankin <j@example.com> (https://x)' })).toEqual({
      name: 'Justin Rankin',
      email: 'j@example.com',
    });
  });

  it('reads the string form with a bare name', () => {
    expect(parsePackageAuthor({ author: 'Justin Rankin' })).toEqual({
      name: 'Justin Rankin',
      email: '',
    });
  });

  it('reads the string form with a name and url but no email', () => {
    expect(parsePackageAuthor({ author: 'Justin Rankin (https://x)' })).toEqual({
      name: 'Justin Rankin',
      email: '',
    });
  });

  it('returns empty strings when author is absent', () => {
    // The case that produced `Copyright (c) 2026` with no name — callers must treat this as
    // "unknown" and skip writing a LICENSE rather than substituting it.
    expect(parsePackageAuthor({})).toEqual({ name: '', email: '' });
  });

  it('returns empty strings for a null or oddly typed author', () => {
    expect(parsePackageAuthor({ author: null })).toEqual({ name: '', email: '' });
    expect(parsePackageAuthor({ author: 42 })).toEqual({ name: '', email: '' });
    expect(parsePackageAuthor({ author: { email: 'j@example.com' } })).toEqual({
      name: '',
      email: 'j@example.com',
    });
  });

  it('trims surrounding whitespace on the string form', () => {
    expect(parsePackageAuthor({ author: '  Justin Rankin  <j@example.com>  ' })).toEqual({
      name: 'Justin Rankin',
      email: 'j@example.com',
    });
  });
});
