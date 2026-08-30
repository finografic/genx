import { createXdgPaths, readJsonc } from '@finografic/core/xdg';
import type { DependencyGroup, PackageType, ToolchainPolicy } from '@finografic/deps-policy/deps.types';

interface PolicySnapshot {
  _meta: { package: string; version: string; generatedAt: string };
  base: DependencyGroup;
  cli: DependencyGroup;
  library: DependencyGroup;
  config: DependencyGroup;
  /** Added in deps-policy 0.27; older snapshots on disk will not have it. */
  react?: DependencyGroup;
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
      // A snapshot written before deps-policy 0.27 has no react group; fall back to the
      // installed package so the field is never undefined.
      react: xdgSnapshot.react ?? installed.policy.react,
    }
  : installed.policy;

const lintingAndFormattingFallback: Record<string, string> = installed.lintingAndFormatting ?? {};
export const formatting: Record<string, string> = xdgSnapshot?.formatting ?? lintingAndFormattingFallback;
export const linting: Record<string, string> = xdgSnapshot?.linting ?? lintingAndFormattingFallback;

export const toolchain: ToolchainPolicy = xdgSnapshot?.toolchain ?? installed.toolchain;

/**
 * Genx package types that deps-policy also knows about.
 *
 * Every genx package type now has a matching policy group, `react` included.
 */
export type PolicyPackageType = PackageType;

/**
 * Map a genx package type onto the policy group that governs its dependency versions.
 *
 * `react` used to resolve to `library` because deps-policy had no group of its own for it.
 * It now has one, so the type passes through and its shared dependencies are policy-managed
 * like every other type. Framework packages (react, react-dom, vite) still come from the
 * `reactVite` feature — policy covers the @finografic packages, not the stack.
 */
export function toPolicyPackageType(id: string): PolicyPackageType {
  return id === 'cli' || id === 'config' || id === 'react' ? id : 'library';
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
