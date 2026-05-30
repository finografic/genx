import { promptMultiSelect } from '@finografic/cli-kit/flow';
import type { FlowContext } from '@finografic/cli-kit/flow';
import { features } from 'features/feature-registry';
import type { FeatureId } from 'features/feature.types';

interface PromptFeaturesOptions {
  excludedValues?: readonly FeatureId[];
  initialValues?: readonly FeatureId[];
}

/**
 * Prompt user to select features.
 * Returns array of selected feature IDs.
 */
export async function promptFeatures(
  flow: FlowContext,
  options: PromptFeaturesOptions = {},
): Promise<FeatureId[]> {
  const excludedValues = new Set(options.excludedValues ?? []);
  const promptOptions = features
    .filter((feature) => !excludedValues.has(feature.id))
    .map((feature) => ({
      value: feature.id,
      label: feature.label,
      hint: feature.hint,
    }));

  return promptMultiSelect(flow, {
    message: 'Select optional features:',
    options: promptOptions,
    initialValues: options.initialValues ? [...options.initialValues] : undefined,
  });
}
