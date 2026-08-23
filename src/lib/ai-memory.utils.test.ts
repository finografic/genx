import { describe, expect, it } from 'vitest';

import {
  isClaudeMemoryPointerContent,
  isMigratableClaudeMemoryContent,
  isMinimalClaudeMdContent,
  mergeClaudeMemoryIntoAgentsMemory,
  stripLegacyClaudeImportHeadings,
  syncMaintenanceBlock,
} from './ai-memory.utils.js';

const CANONICAL =
  '# Project — Handoff\n\n> **How to maintain this file**\n> New rule one.\n> New rule two.\n\n## Capsule\n';

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

  describe('syncMaintenanceBlock', () => {
    it('replaces an outdated maintenance block and leaves the body untouched', () => {
      const target =
        '# Project — Handoff\n\n> **How to maintain this file**\n> Old rule.\n\n## Architecture\n\nProject-authored prose.\n';

      const result = syncMaintenanceBlock(target, CANONICAL);

      expect(result).toBe(
        '# Project — Handoff\n\n> **How to maintain this file**\n> New rule one.\n> New rule two.\n\n## Architecture\n\nProject-authored prose.\n',
      );
    });

    it('is idempotent — a synced file proposes no further change', () => {
      const target = '# Project — Handoff\n\n> Old.\n\n## Architecture\n\nBody.\n';
      const once = syncMaintenanceBlock(target, CANONICAL);

      expect(once).not.toBeNull();
      expect(syncMaintenanceBlock(once as string, CANONICAL)).toBeNull();
    });

    it('reinserts the block when the target has lost it', () => {
      const target = '# Project — Handoff\n\n## Architecture\n\nBody.\n';

      expect(syncMaintenanceBlock(target, CANONICAL)).toBe(
        '# Project — Handoff\n\n> **How to maintain this file**\n> New rule one.\n> New rule two.\n\n## Architecture\n\nBody.\n',
      );
    });

    it('returns null when the canonical file has no block to copy', () => {
      expect(
        syncMaintenanceBlock('# Project — Handoff\n\n> Old.\n', '# Project — Handoff\n\n## Body\n'),
      ).toBeNull();
    });

    it('does not treat a blockquote deeper in the file as the maintenance block', () => {
      // Only the quote directly under the H1 is genx-owned; a quoted note in the body is authored content.
      const target =
        '# Project — Handoff\n\n> **How to maintain this file**\n> New rule one.\n> New rule two.\n\n## Notes\n\n> An authored aside.\n';

      expect(syncMaintenanceBlock(target, CANONICAL)).toBeNull();
    });
  });
});
