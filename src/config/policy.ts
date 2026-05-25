import { createXdgPaths, readJsonc } from '@finografic/cli-kit/xdg';
import type { DependencyGroup, ToolchainPolicy } from '@finografic/deps-policy/deps.types';

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
