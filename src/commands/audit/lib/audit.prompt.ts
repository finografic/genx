import { promptMultiSelect } from '@finografic/cli-kit/flow';
import type { FlowContext } from '@finografic/cli-kit/flow';
import type { FeatureAuditEntry } from './audit.js';
import type { FeatureId } from 'features/feature.types';

import { pc } from 'utils/picocolors';

function statusHint(entry: FeatureAuditEntry): string {
  const badge = entry.status === 'partial' ? pc.yellow('partial') : pc.red('missing');
  return entry.detail ? `${badge} — ${entry.detail}` : badge;
}

/**
 * Multi-select prompt for the audit command. Receives pre-sorted entries (partials first, then missing). All
 * entries are pre-selected; the user deselects what they want to skip.
 */
export async function promptAuditSuggest(
  flow: FlowContext,
  entries: FeatureAuditEntry[],
): Promise<FeatureId[] | null> {
  const options = entries.map((entry) => ({
    value: entry.feature.id,
    label: entry.feature.label,
    hint: statusHint(entry),
  }));

  const initialValues = entries.map((e) => e.feature.id);

  const selected = await promptMultiSelect(flow, {
    message: 'Features to apply (deselect to skip):',
    options,
    initialValues,
    required: true,
  });

  return selected.length > 0 ? selected : null;
}
