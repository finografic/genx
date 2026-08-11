/**
 * Thin Ollama HTTP client for local, one-shot generations.
 *
 * Deliberately not an AI SDK: this is a single local generate call — no streaming,
 * no provider switching. Every failure path returns empty/null rather than throwing,
 * so callers degrade silently to manual entry when Ollama simply isn't running.
 */

import { readEnvValue } from 'utils/dotenv.utils';

const DEFAULT_HOST = 'http://localhost:11434';
/** Detection call — Ollama not running should fail fast, not stall the flow. */
const TAGS_TIMEOUT_MS = 1000;
/**
 * Generation call. Generous because preloaded drafts queue: Ollama serialises requests
 * for the same model, so a draft started during the previous target's prompt waits out
 * that generation before its own begins. A 20s model behind one queued request already
 * exceeds 30s wall time — hence minutes, not seconds. Still bounded so a wedged server
 * cannot hang the flow forever.
 */
const GENERATE_TIMEOUT_MS = 120_000;

export function resolveOllamaHost(): string {
  return readEnvValue('OLLAMA_HOST') ?? DEFAULT_HOST;
}

export function resolveOllamaKeepAlive(): string | undefined {
  return readEnvValue('OLLAMA_KEEP_ALIVE');
}

/**
 * Configured model name, or `undefined` to let `selectModel` fall back to MODEL_PREFERENCE.
 * genx's `.env` takes precedence over an exported shell variable — see `readEnvValue`.
 */
export function resolveOllamaModel(): string | undefined {
  return readEnvValue('OLLAMA_DEFAULT_MODEL');
}

/** Lists installed model names (e.g. `qwen2.5-coder:3b`). Empty on any failure. */
export async function listInstalledModels(host: string): Promise<string[]> {
  try {
    const response = await fetch(`${host}/api/tags`, {
      signal: AbortSignal.timeout(TAGS_TIMEOUT_MS),
    });
    if (!response.ok) return [];

    const body = (await response.json()) as { models?: Array<{ name?: string }> };
    return (body.models ?? [])
      .map((entry) => entry.name)
      .filter((name): name is string => typeof name === 'string' && name.length > 0);
  } catch {
    return [];
  }
}

/** Runs one generation. Returns `null` on any failure — callers fall back silently. */
export async function generate(host: string, model: string, prompt: string): Promise<string | null> {
  const keepAlive = resolveOllamaKeepAlive();

  try {
    const response = await fetch(`${host}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        ...(keepAlive === undefined ? {} : { keep_alive: keepAlive }),
      }),
      signal: AbortSignal.timeout(GENERATE_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const body = (await response.json()) as { response?: string };
    return body.response ?? null;
  } catch {
    return null;
  }
}
