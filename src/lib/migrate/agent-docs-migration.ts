import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { findPackageRoot } from 'utils/package-root.utils';

// ── subfolder map ─────────────────────────────────────────────────────────────

const FOLDER_MAP: Record<string, string> = {
  'typescript-patterns': 'code',
  'eslint-code-style': 'code',
  'modern-typescript-patterns': 'code',
  'provider-context-patterns': 'code',
  'picocolors-cli-styling': 'code',
  'file-naming': 'naming',
  'variable-naming': 'naming',
  'documentation': 'documentation',
  'readme-standards': 'documentation',
  'agent-facing-markdown': 'documentation',
  'feature-design-specs': 'documentation',
  'todo-done-docs': 'documentation',
  'git-policy': 'git',
};

const CANONICAL: Record<string, string[]> = {
  code: [
    'typescript-patterns',
    'eslint-code-style',
    'modern-typescript-patterns',
    'provider-context-patterns',
    'picocolors-cli-styling',
  ],
  naming: ['file-naming', 'variable-naming'],
  documentation: [
    'documentation',
    'readme-standards',
    'agent-facing-markdown',
    'feature-design-specs',
    'todo-done-docs',
  ],
  git: ['git-policy'],
};

// ── result type ───────────────────────────────────────────────────────────────

export interface AgentDocsMigrationResult {
  /** Changes applied (apply mode) or that would be applied (dry-run mode). */
  applied: string[];
  skipped: string[];
  errors: string[];
}

/** True when the target already uses the canonical agent-docs layout. */
export function isAgentDocsAlreadyMigrated(targetDir: string): boolean {
  const instDst = path.join(targetDir, '.github/instructions');
  const hasLayout = layoutPresent(instDst);
  const hasHandoff = !fs.existsSync(path.join(targetDir, '.claude/handoff.md'));
  const claudeMd = path.join(targetDir, 'CLAUDE.md');
  const claudeOk = !fs.existsSync(claudeMd) || fs.readFileSync(claudeMd, 'utf8').trim() === '@AGENTS.md';
  return hasLayout && hasHandoff && claudeOk;
}

// ── layout helpers ────────────────────────────────────────────────────────────

function layoutPresent(instDir: string): boolean {
  return ['code', 'naming', 'documentation', 'git'].every((d) => fs.existsSync(path.join(instDir, d)));
}

function numberedFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d{2}-/.test(f) && f.endsWith('.instructions.md'))
    .map((f) => path.join(dir, f));
}

function stripNumPrefix(filename: string): string {
  return filename.replace(/^\d{2}-/, '');
}

// ── self-migration ────────────────────────────────────────────────────────────

function migrateInPlace(instDir: string, result: AgentDocsMigrationResult): void {
  for (const src of numberedFiles(instDir)) {
    const filename = path.basename(src);
    const name = filename.replace(/^\d{2}-/, '').replace(/\.instructions\.md$/, '');

    if (name === 'general') {
      try {
        fs.rmSync(src);
        result.applied.push(`removed ${filename} (replaced by embedded general.instructions.md)`);
      } catch (e) {
        result.errors.push(`remove ${filename}: ${String(e)}`);
      }
      continue;
    }

    const folder = FOLDER_MAP[name];
    if (!folder) {
      result.skipped.push(`${filename} (no mapping)`);
      continue;
    }

    const dstDir = path.join(instDir, folder);
    const dst = path.join(dstDir, `${name}.instructions.md`);
    try {
      fs.mkdirSync(dstDir, { recursive: true });
      fs.renameSync(src, dst);
      result.applied.push(`${filename} → ${folder}/${name}.instructions.md`);
    } catch (e) {
      result.errors.push(`${filename}: ${String(e)}`);
    }
  }

  // Strip numeric prefixes from project/ files
  const projectDir = path.join(instDir, 'project');
  for (const src of numberedFiles(projectDir)) {
    const filename = path.basename(src);
    const newname = stripNumPrefix(filename);
    const dst = path.join(projectDir, newname);
    try {
      fs.renameSync(src, dst);
      result.applied.push(`project/${filename} → project/${newname}`);
    } catch (e) {
      result.errors.push(`project/${filename}: ${String(e)}`);
    }
  }
}

// ── copy from source ──────────────────────────────────────────────────────────

function copyFromSource(instSrc: string, instDst: string, result: AgentDocsMigrationResult): void {
  const walk = (dir: string): string[] => {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).flatMap((entry) => {
      const full = path.join(dir, entry);
      return fs.statSync(full).isDirectory() ? walk(full) : [full];
    });
  };

  const SKIP_NAMES = new Set(['general.instructions.md', 'README.md']);
  for (const srcFile of walk(instSrc)) {
    const rel = path.relative(instSrc, srcFile);
    if (rel.startsWith('project/') || SKIP_NAMES.has(path.basename(srcFile))) continue;
    const dst = path.join(instDst, rel);
    try {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(srcFile, dst);
      result.applied.push(`copied ${rel}`);
    } catch (e) {
      result.errors.push(`copy ${rel}: ${String(e)}`);
    }
  }
}

// ── embedded files ────────────────────────────────────────────────────────────

const GENERAL_INSTRUCTIONS = `\
# General Development Rules

These rules guide code suggestions and refactors. Apply them consistently across the project.

## Code Quality

- Use TypeScript with \`strict\` mode.
- Prefer type-safe code; avoid \`any\`.
- Use camelCase for variables; PascalCase for types/components.
- Add JSDoc for complex functions and public APIs.
- Prefer explicit return types.

## Control Flow

- Prefer guard clauses over nested \`if/else\`.
- Use single-level ternaries only; avoid nested ternaries.

## Error Handling

- Handle errors explicitly; avoid swallowing.
- Use clear, typed error shapes where feasible.

## Performance & Security

- Minimize dependencies; enable tree-shaking.
- Avoid leaking sensitive data; validate public API inputs.

## Markdown Conventions

- Use plain headings (\`##\`, \`###\`) without extra bold.
- Add blank lines around code blocks.
- Wrap filenames/paths/methods/variables in backticks for inline code.
`;

const INSTRUCTIONS_README = `\
# .github/instructions — AI Instruction Files

Rules and conventions loaded automatically by Claude Code, Cursor, GitHub Copilot, and other
AI coding tools. Files use the \`.instructions.md\` suffix. \`README.md\` (this file) is not loaded
as a rule file — it exists purely for navigation and to define how this folder is maintained.

---

## Folder Structure

| Folder             | Contents                                                                   |
| ------------------ | -------------------------------------------------------------------------- |
| (root)             | \`general.instructions.md\` — baseline rules that apply everywhere           |
| \`code/\`            | TypeScript patterns, ESLint/oxlint style, code conventions, CLI styling    |
| \`naming/\`          | File naming, variable naming, identifier conventions                       |
| \`documentation/\`   | Documentation standards, README rules, agent-facing markdown, design specs |
| \`git/\`             | Commit conventions, branch policy, release process                         |
| \`project/\`         | Project-specific constraints — not part of the shared convention set       |

---

## How to Add a New Instruction File

1. Pick the folder using the table above.
2. Name it descriptively — no numeric prefix: \`my-topic.instructions.md\`.
3. If the rule applies only to this repository (not a general convention), put it in \`project/\`.
4. Add an entry to the relevant section in \`/AGENTS.md\` so agents know it exists.

---

## Rules for This Directory

- **No numeric prefixes.** Names must be descriptive, not ordered.
- **One concern per file.** If a file spans two unrelated topics, split it.
- **General rules** go in \`general.instructions.md\` at the root.
- **\`project/\`** is strictly for repository-specific constraints.
- **Don't add an index here.** \`/AGENTS.md\` is the cross-agent entry point.
`;

function writeEmbeddedFiles(instDir: string, result: AgentDocsMigrationResult): void {
  fs.mkdirSync(instDir, { recursive: true });
  try {
    fs.writeFileSync(path.join(instDir, 'general.instructions.md'), GENERAL_INSTRUCTIONS);
    result.applied.push('general.instructions.md');
  } catch (e) {
    result.errors.push(`general.instructions.md: ${String(e)}`);
  }
  try {
    fs.writeFileSync(path.join(instDir, 'README.md'), INSTRUCTIONS_README);
    result.applied.push('.github/instructions/README.md');
  } catch (e) {
    result.errors.push(`instructions/README.md: ${String(e)}`);
  }
}

// ── handoff migration ─────────────────────────────────────────────────────────

const DEFAULT_HANDOFF_PREAMBLE = `\
# Project — Handoff

> **How to maintain this file**
> Update after sessions that change architecture, add/remove features, resolve open questions, or shift priorities — not every session.
> — Update only the sections that changed. Keep the total under 150 lines.
> — Write in present tense. No code snippets — describe what exists, not how it works.
> — \`.claude/memory.md\` = session work log. \`.agents/handoff.md\` = project state snapshot.

`;

function mergeHandoff(targetDir: string, result: AgentDocsMigrationResult): void {
  const claudeHandoff = path.join(targetDir, '.claude/handoff.md');
  if (!fs.existsSync(claudeHandoff)) {
    result.skipped.push('.claude/handoff.md not found');
    return;
  }

  const agentsDir = path.join(targetDir, '.agents');
  fs.mkdirSync(agentsDir, { recursive: true });

  const outPath = path.join(agentsDir, 'handoff.md');
  if (fs.existsSync(outPath)) {
    const bak = `${outPath}.pre-migrate-${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}Z`;
    fs.copyFileSync(outPath, bak);
    result.applied.push(`.agents/handoff.md backed up → ${path.basename(bak)}`);
  }

  try {
    const raw = fs.readFileSync(claudeHandoff, 'utf8');
    let preamble = DEFAULT_HANDOFF_PREAMBLE;
    const h1Match = raw.match(/^(# .+)$/m);
    const body = raw.replace(/^# .+\n(\n)?/, '');
    if (h1Match) preamble = preamble.replace(/^# .+$/m, h1Match[1]);
    fs.writeFileSync(outPath, preamble + body);
    fs.rmSync(claudeHandoff);
    result.applied.push('.claude/handoff.md → .agents/handoff.md');
  } catch (e) {
    result.errors.push(`handoff merge: ${String(e)}`);
  }
}

// ── canonical files ───────────────────────────────────────────────────────────

function ensureCanonicalFiles(
  instDir: string,
  fallbackInstDir: string,
  result: AgentDocsMigrationResult,
): Array<{ folder: string; name: string }> {
  const extra: Array<{ folder: string; name: string }> = [];

  for (const [folder, names] of Object.entries(CANONICAL)) {
    const folderPath = path.join(instDir, folder);

    if (fs.existsSync(folderPath)) {
      for (const f of fs.readdirSync(folderPath)) {
        if (!f.endsWith('.instructions.md')) continue;
        const name = f.replace(/\.instructions\.md$/, '');
        if (!names.includes(name)) extra.push({ folder, name });
      }
    }

    for (const name of names) {
      const dst = path.join(folderPath, `${name}.instructions.md`);
      if (!fs.existsSync(dst)) {
        const src = path.join(fallbackInstDir, folder, `${name}.instructions.md`);
        if (fs.existsSync(src)) {
          fs.mkdirSync(folderPath, { recursive: true });
          fs.copyFileSync(src, dst);
          result.applied.push(`copied missing ${folder}/${name}.instructions.md`);
        } else {
          result.errors.push(`missing canonical: ${folder}/${name}.instructions.md`);
        }
      }
    }
  }
  return extra;
}

// ── section helpers ───────────────────────────────────────────────────────────

function findSection(lines: string[], match: (h: string) => boolean): [number, number] | null {
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('## ') && match(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      end = i;
      break;
    }
  }
  return [start, end];
}

function hasSection(lines: string[], match: (h: string) => boolean): boolean {
  return findSection(lines, match) !== null;
}

function sectionHasOldPaths(lines: string[], match: (h: string) => boolean): boolean {
  const range = findSection(lines, match);
  if (!range) return false;
  return lines.slice(range[0], range[1]).some((l) => /instructions\/\d{2}-/.test(l));
}

function replaceSection(lines: string[], match: (h: string) => boolean, newLines: string[]): boolean {
  const range = findSection(lines, match);
  if (!range) return false;
  lines.splice(range[0], range[1] - range[0], ...newLines);
  return true;
}

function insertBeforeSection(lines: string[], match: (h: string) => boolean, newLines: string[]): void {
  const range = findSection(lines, match);
  lines.splice(range ? range[0] : lines.length, 0, ...newLines);
}

function insertAfterSection(lines: string[], match: (h: string) => boolean, newLines: string[]): void {
  const range = findSection(lines, match);
  lines.splice(range ? range[1] : lines.length, 0, ...newLines);
}

function insertBeforeFirstSection(lines: string[], newLines: string[]): void {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      lines.splice(i, 0, ...newLines);
      return;
    }
  }
  lines.push(...newLines);
}

// ── section content builders ──────────────────────────────────────────────────

function buildRulesGlobalLines(extra: Array<{ folder: string; name: string }>): string[] {
  const lines = [
    '## Rules — Global',
    '',
    'Rules are canonical in `.github/instructions/` — see `README.md` there for folder structure.',
    'Shared across Claude Code, Cursor, and GitHub Copilot.',
    '',
    '**General**',
    '',
    '- General baseline: `.github/instructions/general.instructions.md`',
    '',
    '**Code**',
    '',
    '- TypeScript patterns: `.github/instructions/code/typescript-patterns.instructions.md`',
    '- Modern TS patterns: `.github/instructions/code/modern-typescript-patterns.instructions.md`',
    '- ESLint & style: `.github/instructions/code/eslint-code-style.instructions.md`',
    '- Provider/context patterns: `.github/instructions/code/provider-context-patterns.instructions.md`',
    '- Picocolors CLI styling: `.github/instructions/code/picocolors-cli-styling.instructions.md`',
    '',
    '**Naming**',
    '',
    '- File naming: `.github/instructions/naming/file-naming.instructions.md`',
    '- Variable naming: `.github/instructions/naming/variable-naming.instructions.md`',
    '',
    '**Documentation**',
    '',
    '- Documentation: `.github/instructions/documentation/documentation.instructions.md`',
    '- README standards: `.github/instructions/documentation/readme-standards.instructions.md`',
    '- Agent-facing markdown: `.github/instructions/documentation/agent-facing-markdown.instructions.md`',
    '- Feature design specs: `.github/instructions/documentation/feature-design-specs.instructions.md`',
    '- TODO/DONE docs: `.github/instructions/documentation/todo-done-docs.instructions.md`',
    '',
    '**Git**',
    '',
    '- Git policy: `.github/instructions/git/git-policy.instructions.md`',
  ];

  if (extra.length > 0) {
    lines.push('', '**Other**', '');
    for (const { folder, name } of extra) {
      const label = name
        .split('-')
        .map((w) => w[0].toUpperCase() + w.slice(1))
        .join(' ');
      lines.push(`- ${label}: \`.github/instructions/${folder}/${name}.instructions.md\``);
    }
  }

  lines.push('', '---', '');
  return lines;
}

const ROADMAP_SECTION_LINES = [
  '## Roadmap and Planning Docs',
  '',
  '**`docs/todo/ROADMAP.md` is the primary high-level plan for this project.**',
  '**`docs/todo/NEXT_STEPS.md` is the near-term working list** — small tasks, fixes, and manual testing checklists too small for ROADMAP.',
  '',
  '- Before proposing or generating new features, check the roadmap for existing items.',
  '- When conceiving a new feature or initiative, add it to the appropriate priority tier.',
  '- Detailed planning docs live alongside in `docs/todo/` as `TODO_*.md` (active) or `DONE_*.md` (complete).',
  '- **TODO/DONE doc conventions:** `.github/instructions/documentation/todo-done-docs.instructions.md`',
  '  — rules for naming, status headers, checkboxes, and graduating `TODO_` → `DONE_`.',
  '',
  '---',
  '',
];

const CLAUDE_CODE_SECTION_LINES = [
  '## Claude Code — Session Memory and Handoff',
  '',
  '> This section applies to Claude Code only. Other agents can ignore it.',
  '',
  '- **Session log:** `.claude/memory.md` (gitignored) — maintenance rules are in that file.',
  '- **Project state snapshot:** `.agents/handoff.md` (git-tracked) — maintenance rules are in that file.',
  '',
  '---',
  '',
];

// ── patch functions ───────────────────────────────────────────────────────────

function patchClaudeMd(targetDir: string, result: AgentDocsMigrationResult): void {
  const claudePath = path.join(targetDir, 'CLAUDE.md');
  if (!fs.existsSync(claudePath)) {
    result.skipped.push('CLAUDE.md not found');
    return;
  }
  const current = fs.readFileSync(claudePath, 'utf8').trim();
  if (current === '@AGENTS.md') {
    result.skipped.push('CLAUDE.md already @AGENTS.md');
    return;
  }
  fs.writeFileSync(claudePath, '@AGENTS.md\n');
  result.applied.push('CLAUDE.md → @AGENTS.md');
}

function patchAgentsMd(
  targetDir: string,
  extra: Array<{ folder: string; name: string }>,
  result: AgentDocsMigrationResult,
): void {
  const agentsPath = path.join(targetDir, 'AGENTS.md');
  if (!fs.existsSync(agentsPath)) {
    result.errors.push('AGENTS.md not found');
    return;
  }

  let text = fs.readFileSync(agentsPath, 'utf8');
  text = text.replace(/^## Rules - /gm, '## Rules — ');
  text = text.replace(/\.github\/instructions\/project\/\d{2}-/g, '.github/instructions/project/');
  text = text.replace(
    /\.github\/instructions\/\d{2}-git-policy\.instructions\.md/g,
    '.github/instructions/git/git-policy.instructions.md',
  );

  const lines = text.split('\n');
  let changed = false;

  if (!hasSection(lines, (h) => /roadmap/i.test(h))) {
    insertBeforeFirstSection(lines, ROADMAP_SECTION_LINES);
    result.applied.push('AGENTS.md: Roadmap section added');
    changed = true;
  }

  if (sectionHasOldPaths(lines, (h) => /rules.*global/i.test(h))) {
    replaceSection(lines, (h) => /rules.*global/i.test(h), buildRulesGlobalLines(extra));
    result.applied.push('AGENTS.md: Rules — Global updated');
    changed = true;
  } else if (!hasSection(lines, (h) => /rules.*global/i.test(h))) {
    insertBeforeSection(
      lines,
      (h) => /markdown tables/i.test(h) || /learned/i.test(h),
      buildRulesGlobalLines(extra),
    );
    result.applied.push('AGENTS.md: Rules — Global section added');
    changed = true;
  }

  if (!hasSection(lines, (h) => /claude code/i.test(h))) {
    insertAfterSection(lines, (h) => /git policy/i.test(h), CLAUDE_CODE_SECTION_LINES);
    result.applied.push('AGENTS.md: Claude Code session section added');
    changed = true;
  }

  if (changed) fs.writeFileSync(agentsPath, lines.join('\n'));
}

function patchCopilotInstructions(
  targetDir: string,
  extra: Array<{ folder: string; name: string }>,
  result: AgentDocsMigrationResult,
): void {
  const filePath = path.join(targetDir, '.github/copilot-instructions.md');
  if (!fs.existsSync(filePath)) {
    result.skipped.push('copilot-instructions.md not found');
    return;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const isRulesSection = (h: string): boolean => /rules?.*global/i.test(h) || /rule\s+files/i.test(h);
  if (!hasSection(lines, isRulesSection)) {
    result.skipped.push('copilot-instructions.md: rules section not found');
    return;
  }
  if (!sectionHasOldPaths(lines, isRulesSection)) {
    result.skipped.push('copilot-instructions.md: already up to date');
    return;
  }

  replaceSection(lines, isRulesSection, buildRulesGlobalLines(extra));
  fs.writeFileSync(filePath, lines.join('\n'));
  result.applied.push('copilot-instructions.md: Rules — Global updated');
}

// ── main entry point ──────────────────────────────────────────────────────────

export async function migrateAgentDocs(
  targetDir: string,
  options: { dryRun?: boolean } = {},
): Promise<AgentDocsMigrationResult> {
  const { dryRun = false } = options;

  // In dry-run mode, collect what WOULD change without touching the filesystem.
  if (dryRun) {
    return planAgentDocsMigration(targetDir);
  }

  const result: AgentDocsMigrationResult = { applied: [], skipped: [], errors: [] };

  const instDst = path.join(targetDir, '.github/instructions');

  // Fallback canonical source: _templates/ in the genx package
  const fromDir = fileURLToPath(new URL('.', import.meta.url));
  const pkgRoot = findPackageRoot(fromDir);
  const fallbackInstDir = path.join(pkgRoot, '_templates/.github/instructions');

  // Instructions layout migration
  if (!fs.existsSync(instDst)) {
    result.skipped.push('.github/instructions not found');
  } else {
    const pending = numberedFiles(instDst);
    if (pending.length > 0) {
      migrateInPlace(instDst, result);
    } else if (!layoutPresent(instDst) && fs.existsSync(fallbackInstDir)) {
      copyFromSource(fallbackInstDir, instDst, result);
    } else {
      result.skipped.push('.github/instructions already in canonical layout');
    }
  }

  writeEmbeddedFiles(instDst, result);
  mergeHandoff(targetDir, result);
  patchClaudeMd(targetDir, result);

  const extra = ensureCanonicalFiles(instDst, fallbackInstDir, result);
  patchAgentsMd(targetDir, extra, result);
  patchCopilotInstructions(targetDir, extra, result);

  return result;
}

/** Dry-run: report what migrateAgentDocs would do without writing anything. */
function planAgentDocsMigration(targetDir: string): AgentDocsMigrationResult {
  const result: AgentDocsMigrationResult = { applied: [], skipped: [], errors: [] };
  const instDst = path.join(targetDir, '.github/instructions');

  if (!fs.existsSync(instDst)) {
    result.skipped.push('.github/instructions not found');
  } else if (numberedFiles(instDst).length > 0) {
    result.applied.push('migrate numbered .github/instructions/ → subfolders');
  } else if (!layoutPresent(instDst)) {
    result.applied.push('copy canonical subfolder layout to .github/instructions/');
  } else {
    result.skipped.push('.github/instructions already in canonical layout');
  }

  result.applied.push('write general.instructions.md + README.md');

  if (fs.existsSync(path.join(targetDir, '.claude/handoff.md'))) {
    result.applied.push('.claude/handoff.md → .agents/handoff.md');
  } else {
    result.skipped.push('.claude/handoff.md not found');
  }

  const claudeMd = path.join(targetDir, 'CLAUDE.md');
  if (fs.existsSync(claudeMd) && fs.readFileSync(claudeMd, 'utf8').trim() !== '@AGENTS.md') {
    result.applied.push('CLAUDE.md → @AGENTS.md');
  } else {
    result.skipped.push('CLAUDE.md already @AGENTS.md or not present');
  }

  const agentsMd = path.join(targetDir, 'AGENTS.md');
  if (fs.existsSync(agentsMd)) {
    const lines = fs.readFileSync(agentsMd, 'utf8').split('\n');
    if (!hasSection(lines, (h) => /roadmap/i.test(h))) result.applied.push('AGENTS.md: add Roadmap section');
    if (
      sectionHasOldPaths(lines, (h) => /rules.*global/i.test(h)) ||
      !hasSection(lines, (h) => /rules.*global/i.test(h))
    )
      {result.applied.push('AGENTS.md: update Rules — Global section');}
    if (!hasSection(lines, (h) => /claude code/i.test(h)))
      {result.applied.push('AGENTS.md: add Claude Code session section');}
  }

  const copilot = path.join(targetDir, '.github/copilot-instructions.md');
  if (fs.existsSync(copilot)) {
    const lines = fs.readFileSync(copilot, 'utf8').split('\n');
    const isRules = (h: string): boolean => /rules?.*global/i.test(h) || /rule\s+files/i.test(h);
    if (hasSection(lines, isRules) && sectionHasOldPaths(lines, isRules))
      {result.applied.push('copilot-instructions.md: update Rules — Global section');}
  }

  return result;
}
