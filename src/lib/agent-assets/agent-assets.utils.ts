import { join, resolve } from 'node:path';
import type { AgentAsset, AgentAssetOwnership } from '@finografic/ai-agent-config';
import { agentAssets, assetsRoot } from '@finografic/ai-agent-config';

/**
 * Reads the `@finografic/ai-agent-config` manifest and its per-asset ownership
 * modes. Features must resolve assets through here rather than hardcoding
 * source paths, so the package stays the single source of truth for what
 * exists and who owns it.
 *
 * Contract: `@finografic-ai-agent-config/docs/reference/DISTRIBUTION_CONTRACT.md`
 */

/** The manifest, widened — `as const` narrows entries and hides optional fields. */
export const agentAssetManifest: readonly AgentAsset[] = agentAssets;

export const agentAssetsSourceRoot = assetsRoot;

const KNOWN_OWNERSHIP: readonly AgentAssetOwnership[] = ['managed', 'merged', 'seed', 'project-owned'];

/** Modes genx can currently apply. `merged` is declared by the contract but unused by any asset. */
const SUPPORTED_OWNERSHIP: readonly AgentAssetOwnership[] = ['managed', 'seed', 'project-owned'];

/**
 * Raised when the manifest declares something genx cannot safely act on.
 * Callers must surface this and abort the asset — never fall back to a default,
 * because guessing `managed` would overwrite consumer-authored content.
 */
export class AgentAssetContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentAssetContractError';
  }
}

function isKnownOwnership(value: unknown): value is AgentAssetOwnership {
  return typeof value === 'string' && KNOWN_OWNERSHIP.includes(value as AgentAssetOwnership);
}

/**
 * Fail closed: return the asset's ownership mode, or throw. An asset with no
 * mode, an unrecognised mode, or a mode genx cannot apply yet stops the sync
 * for that asset rather than being guessed at.
 */
export function requireOwnership(asset: AgentAsset): AgentAssetOwnership {
  const { ownership } = asset;

  if (!isKnownOwnership(ownership)) {
    throw new AgentAssetContractError(
      `Asset '${asset.source}' declares no valid ownership mode (got ${JSON.stringify(ownership)}). ` +
        `Expected one of ${KNOWN_OWNERSHIP.join(', ')}. ` +
        'Refusing to sync it — guessing could overwrite project-authored content. ' +
        'Fix the manifest in @finografic/ai-agent-config.',
    );
  }

  if (!SUPPORTED_OWNERSHIP.includes(ownership)) {
    throw new AgentAssetContractError(
      `Asset '${asset.source}' declares ownership '${ownership}', which genx does not implement yet. ` +
        `Supported: ${SUPPORTED_OWNERSHIP.join(', ')}.`,
    );
  }

  return ownership;
}

/** Validate every asset up front so a bad manifest fails before any file is touched. */
export function validateManifest(): void {
  for (const asset of agentAssetManifest) {
    requireOwnership(asset);
  }
}

/**
 * The manifest entry whose `source` is exactly `source`.
 * Throws when absent — a feature asking for an asset the package no longer
 * ships is a contract break, not a no-op.
 */
export function requireAssetBySource(source: string): AgentAsset {
  const asset = agentAssetManifest.find((entry) => entry.source === source);
  if (!asset) {
    const available = agentAssetManifest.map((entry) => entry.source).join(', ');
    throw new AgentAssetContractError(`No manifest entry for source '${source}'. Available: ${available}.`);
  }
  return asset;
}

/** Absolute path to an asset's source inside the published package. */
export function assetSourcePath(asset: AgentAsset): string {
  return resolve(agentAssetsSourceRoot, asset.source);
}

/** Absolute destination paths for an asset in a consumer repo (one per declared target). */
export function assetTargetPaths(asset: AgentAsset, targetDir: string): string[] {
  const targets = Array.isArray(asset.target) ? asset.target : [asset.target];
  return targets.map((target) => resolve(targetDir, target));
}

/**
 * True when `relPath` (relative to the asset's own source root) falls inside a
 * subtree this entry excludes because another entry owns it with different
 * ownership.
 */
export function isExcludedPath(asset: AgentAsset, relPath: string): boolean {
  const normalized = relPath.split('\\').join('/');
  return (asset.exclude ?? []).some(
    (excluded) => normalized === excluded || normalized.startsWith(`${excluded}/`),
  );
}

/**
 * Entries that carve subtrees out of `asset`, paired with the destination each
 * carve-out maps to. Lets a feature vendor an excluded subtree under its own
 * ownership instead of dropping it entirely.
 */
export function childAssetsOf(asset: AgentAsset): AgentAsset[] {
  return (asset.exclude ?? [])
    .map((excluded) => join(asset.source, excluded))
    .map((source) => agentAssetManifest.find((entry) => entry.source === source))
    .filter((entry): entry is AgentAsset => entry !== undefined);
}
