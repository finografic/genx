import { describe, expect, it } from 'vitest';
import type { FeatureId } from 'features/feature.types';

import { monorepoConfig } from 'config/monorepo.config';

import { partitionFeaturesForWorkspace } from './workspace-features.runner.js';

describe('partitionFeaturesForWorkspace', () => {
  it('routes doc and agent features to the root', () => {
    const partition = partitionFeaturesForWorkspace(['aiAgents', 'aiInstructions', 'aiMemory', 'designMd']);

    expect(partition.root).toEqual(['aiAgents', 'aiInstructions', 'aiMemory', 'designMd']);
    expect(partition.member).toEqual([]);
    expect(partition.blocked).toEqual([]);
  });

  it('routes package-scoped features to members', () => {
    const partition = partitionFeaturesForWorkspace(['vitest', 'css', 'reactVite']);

    expect(partition.member).toEqual(['vitest', 'css', 'reactVite']);
    expect(partition.root).toEqual([]);
  });

  it('blocks starter-owned toolchain features at the root', () => {
    // `oxc-config` rewrites `update:oxc-config` without `--recursive` and swaps the root
    // oxlint.config.ts for the library preset — the damage the create allowlist prevents.
    const partition = partitionFeaturesForWorkspace(['oxc-config', 'markdown', 'gitHooks']);

    expect(partition.blocked).toEqual(['oxc-config', 'markdown', 'gitHooks']);
    expect(partition.root).toEqual([]);
    expect(partition.member).toEqual([]);
  });

  it('splits a mixed selection across all three buckets', () => {
    const partition = partitionFeaturesForWorkspace(['aiAgents', 'vitest', 'oxc-config']);

    expect(partition).toEqual({
      root: ['aiAgents'],
      member: ['vitest'],
      blocked: ['oxc-config'],
    });
  });

  it('preserves selection order within each bucket', () => {
    const partition = partitionFeaturesForWorkspace(['designMd', 'reactVite', 'aiMemory', 'css']);

    expect(partition.root).toEqual(['designMd', 'aiMemory']);
    expect(partition.member).toEqual(['reactVite', 'css']);
  });

  it('returns empty buckets for an empty selection', () => {
    expect(partitionFeaturesForWorkspace([])).toEqual({ root: [], member: [], blocked: [] });
  });

  it('uses the same root allowlist as `create monorepo`', () => {
    // Generation and upgrade must not drift on what a workspace root may receive.
    const partition = partitionFeaturesForWorkspace([...monorepoConfig.rootFeatures]);

    expect(partition.root).toEqual([...monorepoConfig.rootFeatures]);
    expect(partition.blocked).toEqual([]);
  });

  it('classifies every feature id exactly once', () => {
    const allFeatureIds: FeatureId[] = [
      'aiAgents',
      'aiMemory',
      'aiInstructions',
      'css',
      'designMd',
      'gitHooks',
      'githubWorkflow',
      'markdown',
      'oxc-config',
      'reactVite',
      'vitest',
    ];

    const partition = partitionFeaturesForWorkspace(allFeatureIds);
    const total = partition.root.length + partition.member.length + partition.blocked.length;

    expect(total).toBe(allFeatureIds.length);
  });
});
