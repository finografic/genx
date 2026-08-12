import type { CommandHelpConfig } from '@finografic/cli-kit/render-help';

export const help: CommandHelpConfig = {
  command: 'genx design',
  description: 'DESIGN.md machinery — sync with the design system, drift check, render, lint',
  usage: 'genx design <sync|check|render|lint> [path] [options]',
  options: [
    { flag: 'sync --pull', description: 'Refresh DESIGN.md tokens from the canonical design system' },
    {
      flag: 'sync --push',
      description: 'Write DESIGN.md tokens into design system files (always confirmed per file)',
    },
    {
      flag: 'check',
      description: 'Drift guard — exit 1 when DESIGN.md and design system disagree (CI-able)',
    },
    { flag: 'render', description: 'Generate a self-contained DESIGN.html preview' },
    { flag: 'lint', description: 'Validate DESIGN.md against the spec (@google/design.md)' },
    { flag: '--framework <name>', description: 'Force extractor: pandacss | tailwind4' },
    { flag: '--file <path>', description: 'DESIGN.md location relative to target (default: DESIGN.md)' },
    { flag: '--format <fmt>', description: 'Output format for check/lint: text | json' },
    { flag: '--out <path>', description: 'Output path for render (default: DESIGN.html)' },
    { flag: '-y, --yes', description: 'Skip confirmation for sync --pull (never applies to --push)' },
  ],
  examples: [
    { command: 'genx design sync --pull', description: 'Mirror design system tokens into DESIGN.md' },
    { command: 'genx design check --format json', description: 'CI drift check with JSON output' },
    { command: 'genx design render', description: 'Generate DESIGN.html preview' },
    { command: 'genx design lint', description: 'Validate DESIGN.md against the official spec' },
  ],
  howItWorks: [
    'Detects the canonical design system (PandaCSS panda.config, Tailwind v4 @theme)',
    'sync --pull regenerates DESIGN.md YAML frontmatter; the markdown body is human-owned and preserved',
    'sync --push only runs when DESIGN.md declares itself canonical (## Source of Truth)',
    'check re-extracts tokens in memory and compares — nothing is written',
    'Judgement-driven generation/alignment live in the generate-design-md / apply-design-md skills (ai-agent-config)',
  ],
};
