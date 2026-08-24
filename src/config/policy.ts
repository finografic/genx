import { createXdgPaths, readJsonc } from '@finografic/core/xdg';
import type { DependencyGroup, PackageType, ToolchainPolicy } from '@finografic/deps-policy/deps.types';

interface PolicySnapshot {
  _meta: { package: string; version: string; generatedAt: string };
  base: DependencyGroup;
  cli: DependencyGroup;
  library: DependencyGroup;
  config: DependencyGroup;
  formatting: Record<string, string>;
  linting: Record<string, string>;
  toolchain?: ToolchainPolicy;
}

const xdg = createXdgPaths();
const xdgSnapshot = await readJsonc<PolicySnapshot>(xdg.configPath('deps-policy'));

// Prefer XDG snapshot (local dev — updated by `policy update` / `policy snapshot`).
// Fall back to the installed package when no snapshot exists (CI, first run).
const installed = await import('@finografic/deps-policy');

export const policy = xdgSnapshot
  ? {
      base: xdgSnapshot.base,
      cli: xdgSnapshot.cli,
      library: xdgSnapshot.library,
      config: xdgSnapshot.config,
    }
  : installed.policy;

const lintingAndFormattingFallback: Record<string, string> = installed.lintingAndFormatting ?? {};
export const formatting: Record<string, string> = xdgSnapshot?.formatting ?? lintingAndFormattingFallback;
export const linting: Record<string, string> = xdgSnapshot?.linting ?? lintingAndFormattingFallback;

export const toolchain: ToolchainPolicy = xdgSnapshot?.toolchain ?? installed.toolchain;

/**
 * Genx package types that deps-policy also knows about.
 *
 * `react` is a genx package type with no policy group of its own — see `toPolicyPackageType`.
 */
export type PolicyPackageType = PackageType;

/**
 * Map a genx package type onto the policy group that governs its dependency versions.
 *
 * `react` resolves to `library`, which is what it is as far as dependency policy is concerned: a
 * published package, not a binary. Its React-specific dependencies are added by the `reactVite`
 * feature and are outside policy entirely.
 */
export function toPolicyPackageType(id: string): PolicyPackageType {
  return id === 'cli' || id === 'config' ? id : 'library';
}

/**
 * Merge `base` with a package type's own group to get the effective dependency set for that type.
 *
 * Deliberately not re-exported from `@finografic/deps-policy`: the upstream `resolvePolicy` closes
 * over the *installed* package, so it would silently ignore the XDG snapshot that every other
 * export here prefers. Two sources of truth in one command is exactly the drift `genx deps
 * --update-policy` exists to prevent.
 */
export function resolvePolicy(type: PolicyPackageType): DependencyGroup {
  const typePolicy = policy[type];

  return {
    dependencies: { ...policy.base.dependencies, ...typePolicy.dependencies },
    devDependencies: { ...policy.base.devDependencies, ...typePolicy.devDependencies },
  };
}
