import type { DependencyRule, DependencySection } from 'types/dependencies.types';
import type { PackageJson } from 'types/package-json.types';

export interface DependencyChange {
  name: string;
  from?: string;
  to: string;
  operation: 'add' | 'update' | 'noop';
  section: DependencySection;
}

export function planDependencyChanges(
  packageJson: PackageJson,
  rules: DependencyRule[],
): DependencyChange[] {
  const changes: DependencyChange[] = [];

  for (const rule of rules) {
    const section = packageJson[rule.section] ?? {};
    const current = section[rule.name as keyof typeof section];

    if (!current) {
      changes.push({
        name: rule.name,
        to: rule.version,
        operation: 'add',
        section: rule.section,
      });
      continue;
    }

    if (current !== rule.version) {
      changes.push({
        name: rule.name,
        from: current,
        to: rule.version,
        operation: 'update',
        section: rule.section,
      });
    }
  }

  return changes;
}

const DEPENDENCY_SECTIONS: DependencySection[] = ['dependencies', 'devDependencies'];

/**
 * Apply dependency changes to package.json.
 * When adding/updating in one section, removes the dep from the other section
 * (so a dep can be moved from dependencies to devDependencies or vice versa).
 */
export function applyDependencyChanges(
  packageJson: PackageJson,
  changes: DependencyChange[],
): PackageJson {
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

  return next;
}
