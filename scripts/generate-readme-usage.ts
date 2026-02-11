import fs from 'node:fs';
import path from 'node:path';

import { createHelp } from 'help/create.help';
import { featuresHelp } from 'help/features.help';
import { migrateHelp } from 'help/migrate.help';
import { rootHelp } from 'help/root.help';

const ROOT = path.resolve(import.meta.dirname, '..');

// ── Feature READMEs ──────────────────────────────────────────────────

const FEATURE_DIRS = ['dprint', 'vitest', 'ai-rules', 'markdown', 'git-hooks'] as const;

interface FeatureInfo {
  name: string;
  description: string;
  bullets: string[];
}

function parseFeatureReadme(dir: string): FeatureInfo {
  const readmePath = path.join(ROOT, 'src', 'features', dir, 'README.md');
  const content = fs.readFileSync(readmePath, 'utf-8');
  const lines = content.split('\n');

  // h1 title
  const h1Line = lines.find(l => l.startsWith('# '));
  const name = h1Line ? h1Line.replace(/^#\s+/, '').trim() : dir;

  // description = first non-empty line after h1
  const h1Index = lines.indexOf(h1Line!);
  let description = '';
  for (let i = h1Index + 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line) {
      description = line;
      break;
    }
  }

  // bullets under "## What it does"
  const bullets: string[] = [];
  const whatIndex = lines.findIndex(l => /^##\s+What it does/.test(l));
  if (whatIndex !== -1) {
    for (let i = whatIndex + 1; i < lines.length; i++) {
      const line = lines[i]!;
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
    lines.push('| Command | Description |');
    lines.push('| ------- | ----------- |');
    for (const cmd of rootHelp.commands.list) {
      lines.push(`| \`${cmd.label}\` | ${cmd.description} |`);
    }
    lines.push('');
  }

  // Per-command subsections
  const commandConfigs = [
    { name: 'create', help: createHelp },
    { name: 'migrate', help: migrateHelp },
    { name: 'features', help: featuresHelp },
  ] as const;

  for (const { name, help } of commandConfigs) {
    lines.push(`### \`${bin} ${name}\``);
    lines.push('');

    // Usage line
    const usage = [help.main.bin, help.main.args].filter(Boolean).join(' ');
    lines.push('```bash');
    lines.push(usage);
    lines.push('```');
    lines.push('');

    // Examples
    if (help.examples && help.examples.list.length > 0) {
      lines.push('**Examples:**');
      lines.push('');
      lines.push('```bash');
      for (const ex of help.examples.list) {
        lines.push(`# ${ex.label}`);
        lines.push(ex.description);
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

  for (const dir of FEATURE_DIRS) {
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
  migrate: '`--write`, `--only=<sections>`',
  features: 'Interactive prompts',
  help: '-',
};

function generateCommandsRefSection(): string {
  if (!rootHelp.commands) return '';

  const lines: string[] = [];
  lines.push('| Command | Description | Options |');
  lines.push('| ------- | ----------- | ------- |');

  for (const cmd of rootHelp.commands.list) {
    const opts = COMMAND_OPTIONS[cmd.label] ?? '-';
    lines.push(`| \`${cmd.label}\` | ${cmd.description} | ${opts} |`);
  }

  // Global flags
  lines.push('| `--help` / `-h` | Show help (works with commands too) | - |');
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
