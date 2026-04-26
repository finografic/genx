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
 * Filter and sort audit entries for the suggest prompt: drops `installed`, puts `partial` before `missing`,
 * preserves registry order within each group.
 */
export function sortAuditEntries(entries: FeatureAuditEntry[]): FeatureAuditEntry[] {
  const partial = entries.filter((e) => e.status === 'partial');
  const missing = entries.filter((e) => e.status === 'missing');
  return [...partial, ...missing];
}
