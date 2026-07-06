import fs from 'node:fs';
import path from 'node:path';
import type { CommandHelpConfig } from '@finografic/cli-kit/render-help';

import { cliHelp as rootHelp } from '../src/cli.help';
import { help as auditHelp } from '../src/commands/audit/audit.help';
import { help as createHelp } from '../src/commands/create/create.help';
import { help as depsHelp } from '../src/commands/deps/deps.help';
import { help as managedHelp } from '../src/commands/managed/managed.help';
import { help as upgradeHelp } from '../src/commands/migrate/migrate.help';

const ROOT = path.resolve(import.meta.dirname, '..');

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

  const h1Line = lines.find((l) => l.startsWith('# '));
  const name = h1Line ? h1Line.replace(/^#\s+/, '').trim() : dir;

  const h1Index = lines.indexOf(h1Line!);
  let description = '';
  for (let i = h1Index + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line) {
      description = line;
      break;
    }
  }

  const bullets: string[] = [];
  const whatIndex = lines.findIndex((l) => /^##\s+What it does/.test(l));
  if (whatIndex !== -1) {
    for (let i = whatIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('## ')) break;
      if (line.startsWith('- ')) bullets.push(line);
    }
  }

  return { name, description, bullets };
}

// ── CommandHelpConfig → Markdown ─────────────────────────────────────

/** Optional README-only demo media (not shown in terminal `--help`). */
type ReadmeCommandHelpConfig = CommandHelpConfig & {
  readmeDemo?: { alt: string; src: string; width?: number };
};

function formatReadmeDemo(demo: NonNullable<ReadmeCommandHelpConfig['readmeDemo']>): string {
  const width = demo.width !== undefined ? ` width="${demo.width}"` : '';
  return `<img alt="${demo.alt}" src="${demo.src}"${width} />`;
}

function commandHelpToMarkdown(config: ReadmeCommandHelpConfig): string {
  const lines: string[] = [];

  lines.push(`### \`${config.command}\``);
  lines.push('');
  lines.push(config.description);
  lines.push('');

  if (config.readmeDemo) {
    lines.push(formatReadmeDemo(config.readmeDemo));
    lines.push('');
  }

  lines.push('```bash');
  lines.push(config.usage);
  lines.push('```');
  lines.push('');

  if (config.subcommands && config.subcommands.length > 0) {
    lines.push(
      ...buildMarkdownTable(
        ['Subcommand', 'Description'],
        config.subcommands.map((s) => [`\`${s.name}\``, s.description]),
      ),
    );
    lines.push('');
  }

  if (config.options && config.options.length > 0) {
    lines.push(
      ...buildMarkdownTable(
        ['Flag', 'Description'],
        config.options.map((o) => [`\`${o.flag}\``, o.description]),
      ),
    );
    lines.push('');
  }

  if (config.examples && config.examples.length > 0) {
    lines.push('**Examples:**');
    lines.push('');
    lines.push('```bash');
    for (const ex of config.examples) {
      lines.push(`# ${ex.description}`);
      lines.push(ex.command);
      lines.push('');
    }
    if (lines[lines.length - 1] === '') lines.pop();
    lines.push('```');
    lines.push('');
  }

  if (config.sections && config.sections.length > 0) {
    for (const section of config.sections) {
      lines.push(`**${section.title}:**`);
      lines.push('');
      const rows = sectionContentToTableRows(section.content);
      if (rows.length > 0) {
        lines.push(...buildMarkdownTable(['Type', 'Description'], rows));
      } else {
        lines.push(section.content);
      }
      lines.push('');
    }
  }

  if (config.howItWorks && config.howItWorks.length > 0) {
    lines.push('**How it works:**');
    lines.push('');
    for (let i = 0; i < config.howItWorks.length; i++) {
      lines.push(`${i + 1}. ${config.howItWorks[i]}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function sectionContentToTableRows(content: string): string[][] {
  const rows: string[][] = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^(\S+)\s{2,}(.+)$/);
    if (!match) return [];
    rows.push([`\`${match[1]}\``, match[2]]);
  }
  return rows;
}

// ── Usage section ────────────────────────────────────────────────────

const COMMAND_CONFIGS: ReadonlyArray<{ name: string; help: ReadmeCommandHelpConfig }> = [
  { name: 'create', help: createHelp },
  { name: 'upgrade', help: upgradeHelp },
  { name: 'deps', help: depsHelp },
  { name: 'managed', help: managedHelp },
  { name: 'audit', help: auditHelp },
];

const COMMAND_HELP_BY_NAME = new Map(COMMAND_CONFIGS.map((c) => [c.name, c.help]));

function generateUsageSection(): string {
  const lines: string[] = [];

  const { args } = rootHelp.main;
  lines.push('Run directly using `pnpm dlx`:');
  lines.push('');
  lines.push('```bash');
  lines.push(`pnpm dlx @finografic/genx ${args ?? ''}`);
  lines.push('```');
  lines.push('');

  if (rootHelp.commands) {
    lines.push(
      ...buildMarkdownTable(
        ['Command', 'Description'],
        rootHelp.commands.list.map((cmd) => [`\`${cmd.label}\``, cmd.description]),
      ),
    );
    lines.push('');
  }

  for (const { help } of COMMAND_CONFIGS) {
    lines.push(commandHelpToMarkdown(help));
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

function formatOptionsColumn(name: string): string {
  const help = COMMAND_HELP_BY_NAME.get(name);
  if (!help) return '-';

  const parts: string[] = [];

  if (help.subcommands && help.subcommands.length > 0) {
    parts.push(...help.subcommands.map((s) => `\`${s.name}\``));
  }

  if (help.options && help.options.length > 0) {
    parts.push(...help.options.map((o) => `\`${o.flag.split(',')[0].trim()}\``));
  }

  return parts.length > 0 ? parts.join(', ') : '-';
}

function generateCommandsRefSection(): string {
  if (!rootHelp.commands) return '';

  const lines: string[] = [];
  const rows = rootHelp.commands.list.map((cmd) => [
    `\`${cmd.label}\``,
    cmd.description,
    formatOptionsColumn(cmd.label),
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
