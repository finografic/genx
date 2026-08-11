/**
 * Pure logic for AI-drafted commit messages: prompt construction, response cleanup,
 * and model selection. Kept free of I/O so it stays testable without a running Ollama.
 *
 * Ported from the `zconf message` implementation in ~/.zshrc-config (which backs the
 * `_gcai` shell function), so genx has no dependency on that personal config being built.
 */

/** Mirrors `type-enum` in commitlint.config.mjs. */
export const COMMIT_TYPES = [
  'build',
  'chore',
  'ci',
  'deps',
  'docs',
  'feat',
  'fix',
  'refactor',
  'revert',
  'style',
  'test',
] as const;

/** Mirrors `subject-max-length` in commitlint.config.mjs. */
export const MAX_SUBJECT_LENGTH = 100;

/**
 * Best latency/quality balance first. `qwen2.5-coder:3b` reliably names the real
 * change rather than just the touched files. Only consulted when `OLLAMA_DEFAULT_MODEL`
 * is unset or names a model that is not installed.
 */
export const MODEL_PREFERENCE: readonly string[] = [
  'qwen2.5-coder:3b',
  'gemma4:e4b-it-qat',
  'gemma4:e4b-mlx',
  'llama3.2:3b',
  'gemma4:12b-mlx',
];

/** Caps prompt diff size — keeps latency down and stays well inside the context window. */
const MAX_DIFF_CHARS = 8000;

export interface DiffInput {
  readonly diff: string;
  readonly files: readonly string[];
}

function truncateDiff(diff: string): string {
  if (diff.length <= MAX_DIFF_CHARS) return diff;
  return `${diff.slice(0, MAX_DIFF_CHARS)}\n... (diff truncated)`;
}

export function buildPrompt(input: DiffInput): string {
  const fileList = input.files.map((file) => `  ${file}`).join('\n');

  return `You write git commit messages in the Conventional Commits format: \`type(scope): subject\`.

Rules:
- type is REQUIRED and must be one of: ${COMMIT_TYPES.join(', ')}
- The type always comes FIRST, before the parentheses. Never write a bare \`(scope):\` with no type.
- scope is optional. When used: exactly ONE scope, all lowercase, one short word, in parentheses.
  Never combine scopes with commas or slashes. Never use CamelCase — prefer the broad area over
  a specific component name, and describe the specific part in the subject instead.
- NEVER put a filename, a file path, or a file extension in the scope. \`.gitignore\`,
  \`package.json\` and \`README.md\` are files, not scopes. Name the broad area instead
  (\`config\`, \`deps\`, \`docs\`), or leave the scope out entirely — it is optional — and
  name the file in the subject, where it reads naturally.
- subject is imperative mood, lowercase, no trailing period, under ${MAX_SUBJECT_LENGTH} characters
- The subject is plain prose. Never write a second \`type(scope):\` inside it, and never list
  function or symbol names in the scope.
- Output ONLY the commit message on a single line. No explanation, no quotes, no markdown, no body.

These examples show FORMAT ONLY. Never reuse their wording — describe the diff below instead.

  (xxx): do the thing        is wrong -> build: do the thing        (type must come first)
  feat(FooBar): do the thing is wrong -> feat(foo): do the thing    (one lowercase word)
  feat(foo,bar): do the thing is wrong -> feat(foo): do the thing   (only one scope)
  Feat(Foo): Did the thing.  is wrong -> feat(foo): do the thing    (imperative, no period)
  chore(.gitignore): do the thing is wrong -> chore: do the thing in .gitignore  (filename belongs in the subject)
  docs(README.md): do the thing is wrong -> docs: do the thing in README         (filename belongs in the subject)

Changed files:
${fileList}

Diff:
${truncateDiff(input.diff)}

Write one commit message describing the diff above, in the format \`type(scope): subject\`.

Commit message:`;
}

/**
 * Type names models reach for that are not in COMMIT_TYPES, mapped to one that is.
 * Anything unlisted falls back to `chore` rather than being passed through to fail commitlint.
 */
const TYPE_ALIASES: Readonly<Record<string, string>> = {
  bugfix: 'fix',
  chores: 'chore',
  dep: 'deps',
  dependencies: 'deps',
  doc: 'docs',
  feature: 'feat',
  features: 'feat',
  hotfix: 'fix',
  perf: 'refactor',
  performance: 'refactor',
  tests: 'test',
  testing: 'test',
};

/**
 * Reduces whatever the model put in the parentheses to a single lowercase word.
 * Splits on separators (`a, b` / `a/b`) and on CamelCase boundaries (`VaultBrowser` ->
 * `vault`), keeping the first segment — the broad area is the scope, the specific
 * component belongs in the subject. Hyphenated names survive intact.
 *
 * A filename is never a scope: `chore(.gitignore)` and `chore(package.json)` both drop
 * the scope entirely, leaving a bare `chore:`. The scope is optional, so an empty one is
 * always valid, whereas a filename there is noise that belongs in the subject. Detection
 * is simply "contains a dot", checked BEFORE the charset strip so a leading-dot dotfile
 * cannot survive by having its dot removed.
 */
export function normalizeScope(rawScope: string): string {
  const firstToken = rawScope.trim().split(/[,/|&\s]+/)[0] ?? '';

  // Boundary before an uppercase letter following a lowercase/digit, so `VaultBrowser`
  // splits but an all-caps `API` does not.
  const firstSegment = firstToken.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(' ')[0] ?? '';

  const cleaned = firstSegment.toLowerCase().replace(/[^a-z0-9._-]/g, '');

  return cleaned.includes('.') ? '' : cleaned;
}

/**
 * Removes a second conventional header the model tacked onto the subject
 * (`feat(core): refactor(parse): improve x` -> subject is `improve x`). The first
 * header wins. Only a known type name counts, so an ordinary subject containing a
 * colon (`add support for x: y`) is left alone.
 */
function stripNestedHeaders(subject: string): string {
  const known = [...COMMIT_TYPES, ...Object.keys(TYPE_ALIASES)].join('|');
  const nested = new RegExp(`^(?:${known})\\s*(?:\\([^)]*\\))?\\s*!?\\s*:\\s*`, 'i');

  let result = subject;
  // A model that doubles a header sometimes triples it.
  while (nested.test(result)) {
    result = result.replace(nested, '');
  }

  return result.trim();
}

/**
 * Forces the header into `type(scope): subject`, repairing what the prompt alone
 * does not reliably prevent on a small local model:
 *
 * - `(build): x` -> `build: x` (type written inside the parens)
 * - `(sidebar): x` -> `chore(sidebar): x` (scope only, no type)
 * - `feat(VaultBrowser): x` -> `feat(vault): x` (scope case and multi-word)
 * - `feature: x` -> `feat: x` (near-miss type name)
 *
 * A message with no `:` at all is returned untouched.
 */
export function enforceHeaderShape(message: string): string {
  const match = /^([A-Za-z]+)?\s*(?:\(([^)]*)\))?\s*(!)?\s*:\s*(.*)$/.exec(message);
  if (match === null) return message;

  const [, rawType, rawScope, bang, rawSubject] = match;
  const subject = stripNestedHeaders((rawSubject ?? '').trim()).replace(/\.+$/, '');
  if (subject.length === 0) return message;

  let type = (rawType ?? '').toLowerCase();
  let scope = normalizeScope(rawScope ?? '');

  if (type.length === 0) {
    // Nothing before the parens. If the parens held a type name, that was the type
    // all along — otherwise it really is a scope and the type is missing.
    if ((COMMIT_TYPES as readonly string[]).includes(scope)) {
      type = scope;
      scope = '';
    } else {
      type = 'chore';
    }
  } else if (!(COMMIT_TYPES as readonly string[]).includes(type)) {
    type = TYPE_ALIASES[type] ?? 'chore';
  }

  const scopePart = scope.length > 0 ? `(${scope})` : '';
  return `${type}${scopePart}${bang ?? ''}: ${subject}`;
}

/**
 * Trims the subject (not the whole header — commitlint measures the subject) to the
 * limit, preferring the last word boundary so it does not end mid-word.
 */
function truncateSubject(message: string): string {
  const match = /^(.*?:\s*)(.*)$/.exec(message);
  const prefix = match?.[1] ?? '';
  const subject = match?.[2] ?? message;

  if (subject.length <= MAX_SUBJECT_LENGTH) return message;

  const clipped = subject.slice(0, MAX_SUBJECT_LENGTH);
  const lastSpace = clipped.lastIndexOf(' ');
  const cut = lastSpace > MAX_SUBJECT_LENGTH * 0.6 ? clipped.slice(0, lastSpace) : clipped;

  // Cutting at a word boundary regularly strands a conjunction ("... handling and"),
  // which reads worse than ending a word earlier.
  const trimmed = cut.trimEnd().replace(/[\s,]+(?:and|or|but|to|for|with|in|of|the|a|an)$/i, '');

  return `${prefix}${trimmed}`;
}

/**
 * Strips wrapping the model tends to add (backticks, quotes, a leading "Commit message:"
 * echo) and takes the first non-empty line — model output is freeform despite the prompt
 * asking for one line. The result is then forced into a valid conventional-commit header.
 */
export function cleanResponse(raw: string): string {
  const firstLine = raw
    .split('\n')
    .map((line) => line.trim())
    // A line that is only a code-fence marker carries no content.
    .find((line) => line.length > 0 && !/^```[a-z]*$/i.test(line));

  if (firstLine === undefined) return '';

  let cleaned = firstLine;
  cleaned = cleaned.replace(/^commit message:\s*/i, '');
  cleaned = cleaned.replace(/^```[a-z]*\s*|\s*```$/gi, '');
  cleaned = cleaned.replace(/^["'`]+|["'`]+$/g, '');
  cleaned = cleaned.trim();

  if (cleaned.length === 0) return '';

  return truncateSubject(enforceHeaderShape(cleaned));
}

/** Picks the first preferred model that is actually installed. */
export function selectModel(
  installed: readonly string[],
  preferred: string | undefined,
  fallbackOrder: readonly string[] = MODEL_PREFERENCE,
): string | null {
  if (preferred !== undefined && installed.includes(preferred)) return preferred;

  for (const candidate of fallbackOrder) {
    if (installed.includes(candidate)) return candidate;
  }

  return installed[0] ?? null;
}
