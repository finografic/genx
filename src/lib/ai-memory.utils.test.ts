import { describe, expect, it } from 'vitest';

import {
  isClaudeMemoryPointerContent,
  isMigratableClaudeMemoryContent,
  isMinimalClaudeMdContent,
  mergeClaudeMemoryIntoAgentsMemory,
  stripLegacyClaudeImportHeadings,
} from './ai-memory.utils.js';

describe('ai-memory.utils', () => {
  it('detects minimal CLAUDE.md shim', () => {
    expect(isMinimalClaudeMdContent('@AGENTS.md')).toBe(true);
    expect(isMinimalClaudeMdContent('See [AGENTS.md](./AGENTS.md).')).toBe(true);
    expect(isMinimalClaudeMdContent('# Old instructions')).toBe(false);
  });

  it('detects migratable vs pointer Claude memory', () => {
    expect(isMigratableClaudeMemoryContent('# Session Memory\n\nNote\n')).toBe(true);
    expect(isClaudeMemoryPointerContent('# Moved\n\ncanonical session log\n.agents/memory.md\n')).toBe(true);
    expect(isMigratableClaudeMemoryContent('# Moved\n\ncanonical session log\n.agents/memory.md\n')).toBe(
      false,
    );
  });

  it('mergeClaudeMemoryIntoAgentsMemory is idempotent', () => {
    const once = mergeClaudeMemoryIntoAgentsMemory('# Session Memory\n', '# Legacy\n\nNote\n');
    const twice = mergeClaudeMemoryIntoAgentsMemory(once, '# Legacy\n\nNote\n');
    expect(twice).toBe(once);
  });

  it('strips legacy imported-from headings but keeps migrated content', () => {
    expect(
      stripLegacyClaudeImportHeadings(
        '# Session Memory\n\n## Imported from `.claude/memory.md`\n\nLegacy note\n',
      ),
    ).toBe('# Session Memory\n\nLegacy note\n');
  });
});
