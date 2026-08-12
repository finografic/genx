import type { DesignSystemFramework } from 'lib/design-md/design-md.types';

const VALUE_FLAGS = new Set(['--framework', '--file', '--format', '--out']);
const BOOLEAN_FLAGS = new Set(['--pull', '--push', '-y', '--yes']);

export interface DesignArgs {
  positionals: string[];
  pull: boolean;
  push: boolean;
  yes: boolean;
  framework?: DesignSystemFramework;
  file?: string;
  format: 'text' | 'json';
  out?: string;
}

export function parseDesignArgs(args: string[]): DesignArgs {
  const values = new Map<string, string>();
  const booleans = new Set<string>();
  const positionals: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) {
      continue;
    }
    if (VALUE_FLAGS.has(arg)) {
      const value = args[index + 1];
      if (value !== undefined && !value.startsWith('-')) {
        values.set(arg, value);
        index += 1;
      }
    } else if (BOOLEAN_FLAGS.has(arg)) {
      booleans.add(arg);
    } else if (!arg.startsWith('-')) {
      positionals.push(arg);
    }
  }

  const frameworkRaw = values.get('--framework');
  const framework: DesignSystemFramework | undefined =
    frameworkRaw === 'pandacss' || frameworkRaw === 'tailwind4' ? frameworkRaw : undefined;

  return {
    positionals,
    pull: booleans.has('--pull'),
    push: booleans.has('--push'),
    yes: booleans.has('-y') || booleans.has('--yes'),
    framework,
    file: values.get('--file'),
    format: values.get('--format') === 'json' ? 'json' : 'text',
    out: values.get('--out'),
  };
}
