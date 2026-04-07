import semver from 'semver';

import type { DependencyRule, DependencySection } from 'types/dependencies.types';
import type { PackageJson } from 'types/package-json.types';

const PROTOCOL_PREFIX = /^(workspace|file|link|npm|git|http|https):/i;

export interface DependencyChange {
  name: string;
  from?: string;
  to: string;
  operation: 'add' | 'upgrade' | 'downgrade';
  section: DependencySection;
}

export interface PlanDependencyChangesOptions {
  /** When false (default), omit changes that would move to an older policy floor than the current spec. */
  allowDowngrade?: boolean;
}

function isProtocolSpec(spec: string): boolean {
  return PROTOCOL_PREFIX.test(spec.trim());
}

/** Minimum version represented by a semver range or version-ish string; null if not semver-shaped. */
function minVersionOfSpec(spec: string): semver.SemVer | null {
  const trimmed = spec.trim();
  if (isProtocolSpec(trimmed)) {
    return null;
  }
  const range = semver.validRange(trimmed);
  if (range) {
    return semver.minVersion(range);
  }
  const c = semver.coerce(trimmed);
  return c;
}

/**
 * A representative version from the local spec used to test policy satisfaction
 * (min of range, or coerced version).
 */
function representativeVersion(spec: string): string | null {
  const trimmed = spec.trim();
  if (isProtocolSpec(trimmed)) {
    return null;
  }
  const range = semver.validRange(trimmed);
  if (range) {
    return semver.minVersion(range)?.version ?? null;
  }
  const c = semver.coerce(trimmed);
  return c?.version ?? null;
}

function isSemverAligned(current: string, policy: string): boolean {
  if (current === policy) {
    return true;
  }
  const rep = representativeVersion(current);
  if (!rep) {
    return false;
  }
  if (!semver.validRange(policy)) {
    return false;
  }
  return semver.satisfies(rep, policy, { includePrerelease: true });
}

function isPolicyDowngrade(current: string, policy: string): boolean {
  const curMin = minVersionOfSpec(current);
  const polMin = minVersionOfSpec(policy);
  if (!curMin || !polMin) {
    return false;
  }
  return semver.lt(polMin, curMin);
}

function classifyVersionChange(
  current: string,
  policy: string,
  options: PlanDependencyChangesOptions,
): DependencyChange['operation'] | null {
  if (isSemverAligned(current, policy)) {
    return null;
  }

  if (isPolicyDowngrade(current, policy)) {
    return options.allowDowngrade ? 'downgrade' : null;
  }

  return 'upgrade';
}

export function planDependencyChanges(
  packageJson: PackageJson,
  rules: DependencyRule[],
  options: PlanDependencyChangesOptions = {},
): DependencyChange[] {
  const allowDowngrade = options.allowDowngrade === true;
  const changes: DependencyChange[] = [];

  for (const rule of rules) {
    const section = packageJson[rule.section] ?? {};
    const current = section[rule.name as keyof typeof section];
    if (rule.version === undefined) continue;
    const targetVersion = rule.version;

    if (!current) {
      if (rule.optional) continue;
      changes.push({
        name: rule.name,
        to: targetVersion,
        operation: 'add',
        section: rule.section,
      });
      continue;
    }

    const currentStr = String(current);
    if (currentStr === targetVersion) {
      continue;
    }

    const op = classifyVersionChange(currentStr, targetVersion, { allowDowngrade });
    if (op === null) {
      continue;
    }

    changes.push({
      name: rule.name,
      from: currentStr,
      to: targetVersion,
      operation: op,
      section: rule.section,
    });
  }

  return changes;
}

const DEPENDENCY_SECTIONS: DependencySection[] = ['dependencies', 'devDependencies'];

/**
 * Apply dependency changes to package.json.
 * When adding/updating in one section, removes the dep from the other section
 * (so a dep can be moved from dependencies to devDependencies or vice versa).
 */
export function applyDependencyChanges(packageJson: PackageJson, changes: DependencyChange[]): PackageJson {
  const next = { ...packageJson };

  for (const change of changes) {
    // Remove from the other section so we don't end up with the dep in both
    const otherSection = DEPENDENCY_SECTIONS.find((s) => s !== change.section);
    if (otherSection && next[otherSection] && change.name in (next[otherSection] as object)) {
      const other = { ...(next[otherSection] as Record<string, string>) };
      delete other[change.name];
      if (Object.keys(other).length > 0) {
        (next as Record<string, unknown>)[otherSection] = other;
      } else {
        delete (next as Record<string, unknown>)[otherSection];
      }
    }

    if (!next[change.section]) {
      (next as Record<string, unknown>)[change.section] = {};
    }
    const section = next[change.section] as Record<string, string>;
    section[change.name] = change.to;
  }

  // Sort each modified dependency section alphabetically
  const modifiedSections = new Set(changes.map((change) => change.section));
  for (const sectionName of modifiedSections) {
    const section = next[sectionName] as Record<string, string> | undefined;
    if (!section) continue;
    const sorted = Object.fromEntries(Object.entries(section).sort(([a], [b]) => a.localeCompare(b)));
    (next as Record<string, unknown>)[sectionName] = sorted;
  }

  return next;
}
