/**
 * @file flow.utils.ts — SHARED flow framework for @finografic CLI tools.
 *
 * ⚠️  AVOID EDITING THIS FILE DIRECTLY.
 *
 * The exported API surface and behaviour must remain identical across all repos.
 * Minor formatter adjustments (blank lines, trailing commas) are acceptable.
 */

import * as clack from '@clack/prompts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FlagDef {
  alias?: string;
  type: 'boolean' | 'string' | 'number';
  /** When true, accumulates repeated flags into a string[] (e.g. --include a --include b) */
  multi?: boolean;
  description?: string;
}

type FlagDefs = Record<string, FlagDef>;

export interface FlowContext<F extends FlagDefs = FlagDefs> {
  flags: {
    [K in keyof F]: F[K]['type'] extends 'boolean'
      ? boolean
      : F[K]['type'] extends 'number'
        ? number
        : string;
  } & { y?: boolean; yes?: boolean };
  yesMode: boolean;
  args: string[];
}

export interface PromptSelectOpts<T> {
  /** Flag key whose value auto-resolves this prompt (skips showing the prompt) */
  flagKey?: string;
  /** Convert a flag string value to the prompt's return type. Required when Value is non-primitive. */
  fromFlag?: (flagValue: string) => T | undefined;
  message: string;
  options: { value: T; label: string; hint?: string }[];
  default?: T;
  /** When true, always prompt even in yes-mode */
  required?: boolean;
}

export interface PromptTextOpts {
  /** Flag key whose value auto-resolves this prompt (skips showing the prompt) */
  flagKey?: string;
  message: string;
  default?: string | (() => string);
  placeholder?: string;
  validate?: (value: string | undefined) => string | Error | undefined;
  /** When true, always prompt even in yes-mode */
  required?: boolean;
  /** 'exit' (default): process.exit(0) on cancel. 'skip': return default or empty string. */
  cancelBehavior?: 'exit' | 'skip';
}

export interface PromptConfirmOpts {
  message: string;
  default?: boolean;
  /** Message to log when the prompt is auto-skipped via -y */
  skipMessage?: string;
  /** When true, always prompt even in yes-mode */
  required?: boolean;
  /** 'exit' (default): process.exit(0) on cancel. 'skip': return default value. */
  cancelBehavior?: 'exit' | 'skip';
}

export interface PromptMultiSelectOpts<T> {
  /** Flag key whose value auto-resolves this prompt (comma-separated, skips showing the prompt) */
  flagKey?: string;
  message: string;
  options: { value: T; label: string; hint?: string }[];
  initialValues?: T[];
  /** When true, at least one option must be selected (passed to clack) */
  minOne?: boolean;
  /** When true, always prompt even in yes-mode */
  required?: boolean;
}

export interface PromptAutocompleteMultiSelectOpts<T> {
  message: string;
  options: { value: T; label: string; hint?: string }[];
  placeholder?: string;
  initialValues?: T[];
  /** When true, always prompt even in yes-mode */
  required?: boolean;
}

// ─── Flag Parsing ─────────────────────────────────────────────────────────────

export function createFlowContext<F extends FlagDefs>(argv: string[], flagDefs: F): FlowContext<F> {
  const flags: Record<string, unknown> = {};
  const args: string[] = [];

  // Build alias map: alias → canonical name
  const aliasMap: Record<string, string> = {};
  for (const [name, def] of Object.entries(flagDefs)) {
    if (def.alias) aliasMap[def.alias] = name;
  }

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i]!;

    if (arg === '--') {
      args.push(...argv.slice(i + 1));
      break;
    }

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const resolvedKey = aliasMap[key] ?? key;
      const def = flagDefs[resolvedKey] ?? (aliasMap[key] ? flagDefs[aliasMap[key]!] : undefined);

      if (def?.type === 'boolean') {
        flags[resolvedKey] = true;
      } else if (def && i + 1 < argv.length) {
        i++;
        const value = def.type === 'number' ? Number(argv[i]) : argv[i];
        if (def.multi) {
          if (!Array.isArray(flags[resolvedKey])) flags[resolvedKey] = [];
          (flags[resolvedKey] as unknown[]).push(value);
        } else {
          flags[resolvedKey] = value;
        }
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      const alias = arg.slice(1);
      const resolvedKey = aliasMap[alias] ?? alias;
      const def = flagDefs[resolvedKey] ?? Object.values(flagDefs).find((d) => d.alias === alias);

      if (def?.type === 'boolean' || alias === 'y') {
        flags[resolvedKey] = true;
      } else if (def && i + 1 < argv.length) {
        i++;
        const value = def.type === 'number' ? Number(argv[i]) : argv[i];
        if (def.multi) {
          if (!Array.isArray(flags[resolvedKey])) flags[resolvedKey] = [];
          (flags[resolvedKey] as unknown[]).push(value);
        } else {
          flags[resolvedKey] = value;
        }
      }
    } else {
      args.push(arg);
    }

    i++;
  }

  return {
    flags: flags as FlowContext<F>['flags'],
    yesMode: Boolean(flags['y'] || flags['yes']),
    args,
  };
}

// ─── Prompt Helpers ───────────────────────────────────────────────────────────

export async function promptSelect<T>(flow: FlowContext, config: PromptSelectOpts<T>): Promise<T> {
  // Resolution chain: 1. explicit flag (with optional fromFlag resolver)  2. yes-mode default  3. prompt
  if (config.flagKey && flow.flags[config.flagKey as keyof typeof flow.flags] !== undefined) {
    const raw = String(flow.flags[config.flagKey as keyof typeof flow.flags]);
    const resolved = config.fromFlag ? config.fromFlag(raw) : (raw as unknown as T);
    if (resolved !== undefined) return resolved;
    // fromFlag returned undefined → unknown flag value, fall through to prompt
  }

  if (!config.required && flow.yesMode && config.default !== undefined) {
    return config.default;
  }

  const result = await clack.select({
    message: config.message,
    options: config.options as clack.Option<T>[],
  });

  if (clack.isCancel(result)) {
    clack.cancel('Cancelled.');
    process.exit(0);
  }

  return result as T;
}

export async function promptText(flow: FlowContext, config: PromptTextOpts): Promise<string> {
  // Resolution chain: 1. explicit flag  2. yes-mode default  3. prompt
  if (config.flagKey && flow.flags[config.flagKey as keyof typeof flow.flags] !== undefined) {
    const value = String(flow.flags[config.flagKey as keyof typeof flow.flags]);
    if (config.validate) {
      const error = config.validate(value);
      if (error) {
        throw error instanceof Error ? error : new Error(`Invalid --${config.flagKey}: ${error}`);
      }
    }
    return value;
  }

  if (!config.required && flow.yesMode && config.default !== undefined) {
    return typeof config.default === 'function' ? config.default() : config.default;
  }

  const result = await clack.text({
    message: config.message,
    defaultValue: typeof config.default === 'function' ? config.default() : config.default,
    placeholder: config.placeholder,
    validate: config.validate,
  });

  if (clack.isCancel(result)) {
    if (config.cancelBehavior === 'skip') {
      const fallback = typeof config.default === 'function' ? config.default() : config.default;
      return fallback ?? '';
    }
    clack.cancel('Cancelled.');
    process.exit(0);
  }

  return result as string;
}

export async function promptConfirm(flow: FlowContext, config: PromptConfirmOpts): Promise<boolean> {
  // Resolution chain: 1. yes-mode default  2. prompt
  if (!config.required && flow.yesMode) {
    if (config.skipMessage) console.log(config.skipMessage);
    return config.default ?? true;
  }

  const result = await clack.confirm({ message: config.message });

  if (clack.isCancel(result)) {
    if (config.cancelBehavior === 'skip') {
      return config.default ?? false;
    }
    clack.cancel('Cancelled.');
    process.exit(0);
  }

  return result as boolean;
}

export async function promptMultiSelect<T>(
  flow: FlowContext,
  config: PromptMultiSelectOpts<T>,
): Promise<T[]> {
  // Resolution chain: 1. explicit flag  2. yes-mode defaults  3. prompt
  if (config.flagKey && flow.flags[config.flagKey as keyof typeof flow.flags] !== undefined) {
    const raw = String(flow.flags[config.flagKey as keyof typeof flow.flags]);
    return raw.split(',').map((s) => s.trim()) as T[];
  }

  if (!config.required && flow.yesMode && config.initialValues !== undefined) {
    return config.initialValues;
  }

  const result = await clack.multiselect({
    message: config.message,
    options: config.options as clack.Option<T>[],
    initialValues: config.initialValues,
    required: config.minOne ?? false,
  });

  if (clack.isCancel(result)) {
    clack.cancel('Cancelled.');
    process.exit(0);
  }

  return result as T[];
}

export async function promptAutocompleteMultiSelect<T>(
  flow: FlowContext,
  config: PromptAutocompleteMultiSelectOpts<T>,
): Promise<T[]> {
  // Resolution chain: 1. yes-mode defaults  2. prompt
  if (!config.required && flow.yesMode && config.initialValues !== undefined) {
    return config.initialValues;
  }

  const result = await clack.autocompleteMultiselect({
    message: config.message,
    options: config.options as clack.Option<T>[],
    placeholder: config.placeholder,
    initialValues: config.initialValues,
  });

  if (clack.isCancel(result)) {
    clack.cancel('Cancelled.');
    process.exit(0);
  }

  return result as T[];
}
