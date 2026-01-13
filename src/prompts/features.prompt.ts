import * as clack from '@clack/prompts';
import type { FeatureId } from 'features/feature.types';
import { features } from 'features/feature-registry';

import { cancel } from 'utils/prompts.utils';

/**
 * Prompt user to select features.
 * Returns array of selected feature IDs, or null if cancelled.
 */
export async function promptFeatures(): Promise<FeatureId[] | null> {
  const options = features.map((feature) => ({
    value: feature.id,
    label: feature.label,
    hint: feature.hint,
  }));

  const selected = await clack.multiselect({
    message: 'Select optional features:',
    options,
    required: false,
  });

  if (clack.isCancel(selected)) return cancel();

  return selected as FeatureId[];
}
