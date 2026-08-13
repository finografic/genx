import { existsSync } from 'node:fs';
import type { AgentAsset } from '@finografic/ai-agent-config';
import { describe, expect, it } from 'vitest';

import {
  AgentAssetContractError,
  agentAssetManifest,
  assetSourcePath,
  assetTargetPaths,
  childAssetsOf,
  isExcludedPath,
  requireAssetBySource,
  requireOwnership,
  validateManifest,
} from './agent-assets.utils.js';

function fakeAsset(overrides: Partial<AgentAsset>): AgentAsset {
  return {
    kind: 'instruction',
    source: 'fake',
    target: '.agents/fake',
    ownership: 'managed',
    ...overrides,
  };
}

describe('validateManifest', () => {
  it('accepts the shipped manifest', () => {
    expect(() => validateManifest()).not.toThrow();
  });

  it('every declared source exists in the installed package', () => {
    for (const asset of agentAssetManifest) {
      expect(existsSync(assetSourcePath(asset)), `missing source: ${asset.source}`).toBe(true);
    }
  });
});

describe('requireOwnership — fail closed', () => {
  it('returns the mode for a valid asset', () => {
    expect(requireOwnership(fakeAsset({ ownership: 'managed' }))).toBe('managed');
    expect(requireOwnership(fakeAsset({ ownership: 'seed' }))).toBe('seed');
    expect(requireOwnership(fakeAsset({ ownership: 'project-owned' }))).toBe('project-owned');
  });

  it('throws when ownership is missing', () => {
    const asset = fakeAsset({});
    delete (asset as { ownership?: unknown }).ownership;
    expect(() => requireOwnership(asset)).toThrow(AgentAssetContractError);
  });

  it('throws on an unrecognised mode, naming the valid ones', () => {
    const asset = fakeAsset({ ownership: 'whatever' as AgentAsset['ownership'] });
    expect(() => requireOwnership(asset)).toThrow(/Expected one of managed, merged, seed, project-owned/);
  });

  it('throws on merged — declared by the contract but not implemented', () => {
    expect(() => requireOwnership(fakeAsset({ ownership: 'merged' }))).toThrow(/does not implement yet/);
  });

  it('never falls back to a default', () => {
    const asset = fakeAsset({});
    delete (asset as { ownership?: unknown }).ownership;
    expect(() => requireOwnership(asset)).toThrow(/Refusing to sync/);
  });
});

describe('requireAssetBySource', () => {
  it('finds the instructions tree and reports it managed', () => {
    const asset = requireAssetBySource('instructions');
    expect(requireOwnership(asset)).toBe('managed');
    expect(asset.recurse).toBe(true);
  });

  it('finds the project subtree and reports it seed', () => {
    expect(requireOwnership(requireAssetBySource('instructions/project'))).toBe('seed');
  });

  it('finds the skills tree, managed, dual-target', () => {
    const asset = requireAssetBySource('skills');
    expect(requireOwnership(asset)).toBe('managed');
    expect(assetTargetPaths(asset, '/repo')).toEqual(['/repo/.agents/skills', '/repo/.claude/skills']);
  });

  it('throws for an unknown source', () => {
    expect(() => requireAssetBySource('nope')).toThrow(AgentAssetContractError);
  });
});

describe('isExcludedPath', () => {
  const instructions = requireAssetBySource('instructions');

  it('excludes the carved-out subtree and its descendants', () => {
    expect(isExcludedPath(instructions, 'project')).toBe(true);
    expect(isExcludedPath(instructions, 'project/local.instructions.md')).toBe(true);
  });

  it('does not exclude siblings or lookalike prefixes', () => {
    expect(isExcludedPath(instructions, 'code/typescript-patterns.instructions.md')).toBe(false);
    expect(isExcludedPath(instructions, 'projections/thing.md')).toBe(false);
  });

  it('is a no-op for assets without exclusions', () => {
    expect(isExcludedPath(requireAssetBySource('skills'), 'maintain-agents/SKILL.md')).toBe(false);
  });
});

describe('childAssetsOf', () => {
  it('resolves each exclusion to the entry that claims it', () => {
    const children = childAssetsOf(requireAssetBySource('instructions'));
    expect(children.map((child) => child.source)).toEqual(['instructions/project']);
    expect(children.map((child) => requireOwnership(child))).toEqual(['seed']);
  });

  it('returns nothing when there are no exclusions', () => {
    expect(childAssetsOf(requireAssetBySource('skills'))).toEqual([]);
  });
});
