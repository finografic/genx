import { promptMultiSelect } from '@finografic/cli-kit/flow';
import type { FlowContext } from '@finografic/cli-kit/flow';
import type { FeatureAuditEntry } from './audit.js';
import type { FeatureId } from 'features/feature.types';

import { pc } from 'utils/picocolors';

function statusHint(entry: FeatureAuditEntry): string {
  const badge = entry.status === 'partial' ? pc.yellow('partial') : pc.red('missing');
  return entry.detail ? `${badge} — ${entry.detail}` : badge;
}

function optionLabel(entry: FeatureAuditEntry): string {
  return `${entry.feature.label} ${pc.gray(`(${statusHint(entry)})`)}`;
}

/**
 * Multi-select prompt for the audit command. Receives pre-sorted entries (partials first, then missing). No
 * entries are pre-selected; the user explicitly selects what they want to apply.
 */
export async function promptAuditSuggest(
  flow: FlowContext,
  entries: FeatureAuditEntry[],
): Promise<FeatureId[] | null> {
  const options = entries.map((entry) => ({
    value: entry.feature.id,
    label: optionLabel(entry),
  }));

  const selected = await promptMultiSelect(flow, {
    message: 'Features to apply (select to apply):',
    options,
    required: true,
  });

  return selected.length > 0 ? selected : null;
}
