import type { FeatureId } from 'features/feature.types';
import { features } from 'features/feature-registry';

import type { FlowContext } from 'utils/flow.utils';
import { promptMultiSelect } from 'utils/flow.utils';

/**
 * Prompt user to select features.
 * Returns array of selected feature IDs.
 */
export async function promptFeatures(
  flow: FlowContext,
  initialValues?: FeatureId[],
): Promise<FeatureId[]> {
  const options = features.map((feature) => ({
    value: feature.id,
    label: feature.label,
    hint: feature.hint,
  }));

  return promptMultiSelect(flow, {
    message: 'Select optional features:',
    options,
    initialValues,
  });
}
