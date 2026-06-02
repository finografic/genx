import { features } from 'features/feature-registry';
import type { AuditResult, AuditStatus, Feature, FeatureContext } from 'features/feature.types';

export interface FeatureAuditEntry {
  feature: Feature;
  status: AuditStatus;
  detail?: string;
}

/**
 * Run audit detection for all registered features and return a status entry for each. Safe to call
 * programmatically — no prompts or side effects.
 */
export async function auditFeatures(context: FeatureContext): Promise<FeatureAuditEntry[]> {
  const entries: FeatureAuditEntry[] = [];

  for (const feature of features) {
    let result: AuditResult;

    if (feature.audit) {
      result = await feature.audit(context);
    } else if (feature.detect) {
      const installed = await feature.detect(context);
      result = { status: installed ? 'installed' : 'missing' };
    } else {
      result = { status: 'missing' };
    }

    entries.push({ feature, status: result.status, detail: result.detail });
  }

  return entries;
}

/**
 * Sort audit entries for the suggest prompt: puts actionable `partial` / `missing` entries first, followed by
 * visible-but-disabled `installed` entries. Preserves registry order within each group.
 */
export function sortAuditEntries(entries: FeatureAuditEntry[]): FeatureAuditEntry[] {
  const partial = entries.filter((e) => e.status === 'partial');
  const missing = entries.filter((e) => e.status === 'missing');
  const installed = entries.filter((e) => e.status === 'installed');
  return [...partial, ...missing, ...installed];
}

/**
 * Drop features that ship as the target package itself (see {@link Feature.selfPackageName}).
 */
export function filterAuditEntriesForSelfPackage(
  entries: FeatureAuditEntry[],
  targetPackageName: string | undefined,
): FeatureAuditEntry[] {
  if (!targetPackageName) return entries;
  return entries.filter((e) => e.feature.selfPackageName !== targetPackageName);
}
