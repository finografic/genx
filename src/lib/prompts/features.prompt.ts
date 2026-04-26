import { promptMultiSelect } from '@finografic/cli-kit/flow';
import type { FlowContext } from '@finografic/cli-kit/flow';
import { features } from 'features/feature-registry';
import type { FeatureId } from 'features/feature.types';

/**
 * Prompt user to select features. Returns array of selected feature IDs.
 */
export async function promptFeatures(flow: FlowContext, initialValues?: FeatureId[]): Promise<FeatureId[]> {
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
