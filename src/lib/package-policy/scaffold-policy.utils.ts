import type { DependencyGroup } from '@finografic/deps-policy/deps.types';

import type { DependencySection } from 'types/dependencies.types';
import type { PackageJson } from 'types/package-json.types';

const SECTIONS: DependencySection[] = ['dependencies', 'devDependencies'];

const PROTOCOL_PREFIX = /^(workspace|file|link|npm|git|http|https):/i;

export interface AlignedDependency {
  name: string;
  from: string;
  to: string;
  section: DependencySection;
}

export interface AlignScaffoldResult {
  packageJson: PackageJson;
  aligned: AlignedDependency[];
}

/**
 * Rewrite a freshly scaffolded `package.json` so every dependency it already declares carries the
 * version deps-policy specifies for its package type.
 *
 * Alignment only — nothing is added or removed. `_templates/package.json` decides *which*
 * dependencies a new package gets; policy decides *which versions*. Splitting it that way keeps the
 * template's per-type composition intact while removing the second copy of every version number,
 * which is the part that goes stale: a hardcoded template version is wrong the day policy moves and
 * nothing reports it.
 *
 * Adding missing policy entries here would be wrong, not merely broader — feature selection happens
 * after scaffolding, so a package whose user declined `vitest` would still be handed vitest.
 *
 * Protocol specs (`workspace:`, `link:`, `file:`, …) are left alone: they are a deliberate
 * override of registry resolution, and a version range would silently undo it.
 */
export function alignScaffoldDependencies(
  packageJson: PackageJson,
  resolved: DependencyGroup,
): AlignScaffoldResult {
  const next: PackageJson = { ...packageJson };
  const aligned: AlignedDependency[] = [];

  for (const section of SECTIONS) {
    const declared = packageJson[section];
    if (!declared) continue;

    const policyVersions = resolved[section] ?? {};
    const updated: Record<string, string> = { ...declared };

    for (const [name, current] of Object.entries(declared)) {
      const target = policyVersions[name];
      if (target === undefined || target === current) continue;
      if (PROTOCOL_PREFIX.test(current.trim())) continue;

      updated[name] = target;
      aligned.push({ name, from: current, to: target, section });
    }

    next[section] = updated;
  }

  return { packageJson: next, aligned };
}
