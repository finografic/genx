import { describe, expect, it } from 'vitest';

import { parseDotenv } from './dotenv.utils.js';

describe('parseDotenv', () => {
  it('parses plain KEY=VALUE pairs', () => {
    const values = parseDotenv('FOO=bar\nBAZ=qux');
    expect(values.get('FOO')).toBe('bar');
    expect(values.get('BAZ')).toBe('qux');
  });

  it('ignores comments and blank lines', () => {
    const values = parseDotenv('# a comment\n\nFOO=bar\n   \n#FOO=wrong');
    expect(values.get('FOO')).toBe('bar');
    expect(values.size).toBe(1);
  });

  it('strips an export prefix and surrounding quotes', () => {
    const values = parseDotenv('export FOO="bar"\nBAZ=\'qux\'');
    expect(values.get('FOO')).toBe('bar');
    expect(values.get('BAZ')).toBe('qux');
  });

  it('keeps values containing an equals sign intact', () => {
    expect(parseDotenv('URL=http://host/a?b=c').get('URL')).toBe('http://host/a?b=c');
  });

  it('preserves a model tag containing a colon', () => {
    expect(parseDotenv('OLLAMA_DEFAULT_MODEL=gemma4:e4b-it-qat').get('OLLAMA_DEFAULT_MODEL')).toBe(
      'gemma4:e4b-it-qat',
    );
  });

  it('skips malformed lines with no key', () => {
    const values = parseDotenv('=novalue\nnoequals\nFOO=bar');
    expect(values.size).toBe(1);
    expect(values.get('FOO')).toBe('bar');
  });
});
