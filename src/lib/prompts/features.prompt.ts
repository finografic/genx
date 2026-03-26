import type { FeatureId } from 'features/feature.types';
import { features } from 'features/feature-registry';

import type { FlowContext } from 'utils/flow.utils';
import { promptMultiSelect } from 'utils/flow.utils';

/**
 * Prompt user to select features.
 * In yes-mode, returns initialValues (the package type's default features).
 * Returns array of selected feature IDs, or null if cancelled.
 */
export async function promptFeatures(
  initialValues: FeatureId[] | undefined,
  flow: FlowContext,
): Promise<FeatureId[] | null> {
  const options = features.map((feature) => ({
    value: feature.id,
    label: feature.label,
    hint: feature.hint,
  }));

  const selected = await promptMultiSelect(flow, {
    message: 'Select optional features:',
    options,
    initialValues,
    minOne: false,
  });

  return selected as FeatureId[];
}
