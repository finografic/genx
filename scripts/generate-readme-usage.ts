import fs from 'node:fs';
import path from 'node:path';

import { cliHelp as rootHelp } from '../src/cli.help';
import { help as createHelp } from '../src/commands/create/create.help';
import { help as depsHelp } from '../src/commands/deps/deps.help';
import { help as featuresHelp } from '../src/commands/features/features.help';
import { help as migrateHelp } from '../src/commands/migrate/migrate.help';

const ROOT = path.resolve(import.meta.dirname, '..');

// IMPORTANT: to be migrated..
// TODO: MAKE THIS A SCRIPT FOR 🦋 @finografic/project-scripts

// ── Feature READMEs ──────────────────────────────────────────────────

const FEATURES_ROOT = path.join(ROOT, 'src', 'features');

function getDirsWithReadme(rootDir: string): string[] {
  return fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((dir) => fs.existsSync(path.join(rootDir, dir, 'README.md')))
    .toSorted((a, b) => a.localeCompare(b));
}

interface FeatureInfo {
  name: string;
  description: string;
  bullets: string[];
}

function buildMarkdownTable(headers: string[], rows: string[][]): string[] {
  const widths = headers.map((header, idx) =>
    Math.max(header.length, ...rows.map((row) => (row[idx] ?? '').length)),
  );

  const formatRow = (cells: string[]): string =>
    `| ${cells.map((cell, idx) => (cell ?? '').padEnd(widths[idx])).join(' | ')} |`;

  return [
    formatRow(headers),
    `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`,
    ...rows.map((row) => formatRow(row)),
  ];
}

function parseFeatureReadme(dir: string): FeatureInfo {
  const readmePath = path.join(FEATURES_ROOT, dir, 'README.md');
  const content = fs.readFileSync(readmePath, 'utf-8');
  const lines = content.split('\n');

  // h1 title
  const h1Line = lines.find((l) => l.startsWith('# '));
  const name = h1Line ? h1Line.replace(/^#\s+/, '').trim() : dir;

  // description = first non-empty line after h1
  const h1Index = lines.indexOf(h1Line!);
  let description = '';
  for (let i = h1Index + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line) {
      description = line;
      break;
    }
  }

  // bullets under "## What it does"
  const bullets: string[] = [];
  const whatIndex = lines.findIndex((l) => /^##\s+What it does/.test(l));
  if (whatIndex !== -1) {
    for (let i = whatIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('## ')) break; // next section
      if (line.startsWith('- ')) bullets.push(line);
    }
  }

  return { name, description, bullets };
}

// ── Usage section ────────────────────────────────────────────────────

function generateUsageSection(): string {
  const lines: string[] = [];

  // Root signature
  const { bin, args } = rootHelp.main;
  lines.push('Run directly using `pnpm dlx`:');
  lines.push('');
  lines.push('```bash');
  lines.push(`pnpm dlx @finografic/genx ${args ?? ''}`);
  lines.push('```');
  lines.push('');

  // Commands table
  if (rootHelp.commands) {
    lines.push(
      ...buildMarkdownTable(
        ['Command', 'Description'],
        rootHelp.commands.list.map((cmd) => [`\`${cmd.label}\``, cmd.description]),
      ),
    );
    lines.push('');
  }

  // Per-command subsections
  const commandConfigs = [
    { name: 'create', help: createHelp },
    { name: 'migrate', help: migrateHelp },
    { name: 'deps', help: depsHelp },
    { name: 'features', help: featuresHelp },
  ] as const;

  for (const { name, cmdHelp } of commandConfigs.map((c) => ({ name: c.name, cmdHelp: c.help }))) {
    lines.push(`### \`${bin} ${name}\``);
    lines.push('');

    // Usage line
    lines.push('```bash');
    lines.push(cmdHelp.usage);
    lines.push('```');
    lines.push('');

    // Examples
    if (cmdHelp.examples && cmdHelp.examples.length > 0) {
      lines.push('**Examples:**');
      lines.push('');
      lines.push('```bash');
      for (const ex of cmdHelp.examples) {
        lines.push(`# ${ex.description}`);
        lines.push(ex.command);
        lines.push('');
      }
      // remove trailing blank line inside code block
      if (lines[lines.length - 1] === '') lines.pop();
      lines.push('```');
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ── Features section ─────────────────────────────────────────────────

function generateFeaturesSection(): string {
  const lines: string[] = [];

  for (const dir of getDirsWithReadme(FEATURES_ROOT)) {
    const feature = parseFeatureReadme(dir);
    lines.push(`### ${feature.name}`);
    lines.push('');
    lines.push(feature.description);
    lines.push('');
    if (feature.bullets.length > 0) {
      for (const bullet of feature.bullets) {
        lines.push(bullet);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ── In-place replacement ─────────────────────────────────────────────

function replaceBetweenMarkers(
  content: string,
  startMarker: string,
  endMarker: string,
  replacement: string,
): string {
  const startIdx = content.indexOf(startMarker);
  const endIdx = content.indexOf(endMarker);

  if (startIdx === -1) throw new Error(`Marker not found: ${startMarker}`);
  if (endIdx === -1) throw new Error(`Marker not found: ${endMarker}`);

  const before = content.slice(0, startIdx + startMarker.length);
  const after = content.slice(endIdx);

  return `${before}\n\n${replacement}\n${after}`;
}

// ── Commands Reference section ────────────────────────────────────────

/** Extra info not in helpConfig — maps command label to options column */
const COMMAND_OPTIONS: Record<string, string> = {
  create: 'Interactive prompts',
  migrate: '`--write`, `--only=<sections>`, `--managed`, `--yes`',
  deps: '`--managed`, `--yes`, `--no-downgrade`, `--update-policy`',
  features: '`--managed`, `--yes`',
  help: '-',
};

function generateCommandsRefSection(): string {
  if (!rootHelp.commands) return '';

  const lines: string[] = [];
  const rows = rootHelp.commands.list.map((cmd) => [
    `\`${cmd.label}\``,
    cmd.description,
    COMMAND_OPTIONS[cmd.label] ?? '-',
  ]);
  rows.push(['`--help` / `-h`', 'Show help (works with commands too)', '-']);
  lines.push(...buildMarkdownTable(['Command', 'Description', 'Options'], rows));

  lines.push('');
  lines.push('See `genx <command> --help` for detailed usage.');

  return lines.join('\n');
}

// ── Main ─────────────────────────────────────────────────────────────

const readmePath = path.join(ROOT, 'README.md');
let readme = fs.readFileSync(readmePath, 'utf-8');

readme = replaceBetweenMarkers(
  readme,
  '<!-- GENERATED:USAGE:START -->',
  '<!-- GENERATED:USAGE:END -->',
  generateUsageSection(),
);

readme = replaceBetweenMarkers(
  readme,
  '<!-- GENERATED:FEATURES:START -->',
  '<!-- GENERATED:FEATURES:END -->',
  generateFeaturesSection(),
);

readme = replaceBetweenMarkers(
  readme,
  '<!-- GENERATED:COMMANDS_REF:START -->',
  '<!-- GENERATED:COMMANDS_REF:END -->',
  generateCommandsRefSection(),
);

fs.writeFileSync(readmePath, readme);
console.log('✅ README.md updated');
